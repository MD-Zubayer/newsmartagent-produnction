from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import AgentAI, Contact, ScheduledMessage
from .serializers import ContactSerializer, MessageSerializer, ScheduledMessageSerializer
from chat.models import Conversation, Message
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count
from django.utils import timezone
from datetime import datetime
from aiAgent.models import UserMemory
from celery import shared_task
from django.db import transaction
from aiAgent.business_logic.logic_handler import (
    deliver_whatsapp_reply,
    deliver_instagram_reply,
    deliver_facebook_reply,
    deliver_telegram_reply,
    check_schedule_quota,
    deduct_schedule_quota,
    restore_schedule_quota,
)
from aiAgent.models import TelegramBot
import uuid
import logging
logger = logging.getLogger('aiAgent')
class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, agent_id):
        try:
            owner = request.user.get_workspace_owner()
            tm = request.user.get_active_team_member()
            query = request.GET.get('q', '')
            platform_filter = request.GET.get('platform')
            comments_only = request.GET.get('comments_only') == 'true'
            
            if agent_id == 'all':
                # Fetch contacts for all agents of this owner/workspace
                contacts = Contact.objects.filter(agent__user=owner)
                if tm and tm.allowed_agents.exists():
                    contacts = contacts.filter(agent__in=tm.allowed_agents.all())
            else:
                if agent_id.isdigit():
                    try:
                        agent = AgentAI.objects.get(id=int(agent_id), user=owner)
                    except AgentAI.DoesNotExist:
                        agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=owner)
                else:
                    agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=owner)
                contacts = Contact.objects.filter(agent=agent)
            
            if query:
                # Normalize query for more robust searching
                cleaned_query = query.strip().lower()
                contacts = contacts.filter(
                    models.Q(name__icontains=query) | 
                    models.Q(push_name__icontains=query) | 
                    models.Q(identifier__icontains=cleaned_query) |
                    models.Q(identifier__icontains=cleaned_query.replace('@s.whatsapp.net', ''))
                )

            comment_platforms = ['youtube', 'facebook_comment']

            # By default exclude comment platforms from the main list; allow explicit filter
            if comments_only:
                contacts = contacts.filter(platform__in=comment_platforms)
            elif platform_filter:
                contacts = contacts.filter(platform=platform_filter)
            else:
                contacts = contacts.exclude(platform__in=comment_platforms)

            # Queue filter: all | waiting | mine | unassigned
            queue = request.GET.get('queue', 'all')
            active_support_q = (
                models.Q(is_human_needed=True) |
                models.Q(support_status__in=['waiting_human', 'in_progress']) |
                models.Q(waiting_since__isnull=False)
            ) & ~models.Q(support_status='resolved', is_human_needed=False)

            if queue == 'waiting':
                contacts = contacts.filter(active_support_q)
            elif queue == 'mine':
                if tm:
                    contacts = contacts.filter(assigned_to=tm).exclude(support_status='resolved', is_human_needed=False)
                else:
                    contacts = contacts.filter(
                        models.Q(assigned_by=request.user) | models.Q(assigned_to__user=request.user)
                    ).exclude(support_status='resolved', is_human_needed=False)
            elif queue == 'unassigned':
                contacts = contacts.filter(active_support_q, assigned_to__isnull=True)

            contacts = contacts.order_by('-updated_at')
            serializer = ContactSerializer(contacts[:500], many=True)
            
            # Sort contacts: those with a recent message history float to the top
            def sort_key(c):
                time_str = c.get('last_message_time')
                return (time_str is not None, time_str or "")
            
            sorted_contacts = sorted(serializer.data, key=sort_key, reverse=True)
            
            return Response({"contacts": sorted_contacts}, status=status.HTTP_200_OK)
        except AgentAI.DoesNotExist:
            return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)


class ContactSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        owner = request.user.get_workspace_owner()
        qs = Contact.objects.filter(agent__user=owner)
        
        tm = request.user.get_active_team_member()
        if tm and tm.allowed_agents.exists():
            qs = qs.filter(agent__in=tm.allowed_agents.all())

        summary = qs.values('platform').annotate(total=Count('id'))
        data = {item['platform']: item['total'] for item in summary}
        data.setdefault('youtube', 0)
        data.setdefault('facebook_comment', 0)
        data['comments'] = qs.filter(platform__in=['youtube', 'facebook_comment']).count()
        data['messages'] = qs.exclude(platform__in=['youtube', 'facebook_comment']).count()

        # Priority waiting queue counts
        from django.db.models import Q
        waiting_q = (
            Q(is_human_needed=True) |
            Q(support_status__in=['waiting_human', 'in_progress']) |
            Q(waiting_since__isnull=False)
        ) & ~Q(support_status='resolved', is_human_needed=False)
        data['waiting_human'] = qs.filter(waiting_q).count()
        data['unassigned_human'] = qs.filter(waiting_q, assigned_to__isnull=True).count()
        if tm:
            data['my_assigned'] = qs.filter(assigned_to=tm).exclude(support_status='resolved', is_human_needed=False).count()
        else:
            data['my_assigned'] = qs.filter(
                Q(assigned_by=request.user) | Q(assigned_to__user=request.user)
            ).exclude(support_status='resolved', is_human_needed=False).count()

        return Response(data, status=status.HTTP_200_OK)

def _resolve_and_enable_ai(contact, user=None):
    """Fully resolve human handoff / team assignment and re-enable AI auto-reply."""
    contact.is_auto_reply_enabled = True
    contact.is_human_needed = False
    contact.support_status = 'resolved'
    contact.waiting_since = None
    contact.assigned_to = None
    contact.assigned_by = None
    contact.assigned_department = ''
    contact.assignment_note = ''
    contact.resolved_at = timezone.now()
    if user and getattr(user, 'is_authenticated', False):
        contact.resolved_by = user

    try:
        from aiAgent.models import UserMemory
        memory = UserMemory.objects.filter(ai_agent=contact.agent, sender_id=contact.identifier).first()
        if memory and isinstance(memory.data, dict):
            internal = memory.data.get('_internal')
            if isinstance(internal, dict) and 'failed_attempts' in internal:
                internal['failed_attempts'] = {}
                memory.data['_internal'] = internal
                memory.save(update_fields=['data'])
    except Exception:
        pass


class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, contact_id):
        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            serializer = ContactSerializer(contact)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, contact_id):
        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            
            crm_data = request.data.get('crm_data')
            if crm_data and isinstance(crm_data, dict):
                from aiAgent.models import UserMemory
                memory, _ = UserMemory.objects.get_or_create(ai_agent=contact.agent, sender_id=contact.identifier)
                if not isinstance(memory.data, dict):
                    memory.data = {}
                if 'lead_stage' in crm_data: memory.data['lead_stage'] = crm_data['lead_stage']
                if 'phone' in crm_data: memory.data['phone_number'] = crm_data['phone']
                if 'email' in crm_data: memory.data['email'] = crm_data['email']
                if 'ai_summary' in crm_data: memory.data['memory_summary'] = crm_data['ai_summary']
                memory.save()

            serializer = ContactSerializer(contact, data=request.data, partial=True)
            if serializer.is_valid():
                contact = serializer.save()
                if 'is_auto_reply_enabled' in request.data:
                    if bool(request.data.get('is_auto_reply_enabled')):
                        _resolve_and_enable_ai(contact, request.user)
                    else:
                        contact.is_auto_reply_enabled = False
                        contact.is_human_needed = True
                        contact.support_status = 'in_progress'
                        contact.waiting_since = None
                    contact.save()
                return Response(ContactSerializer(contact).data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

class ToggleAutoReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            explicit_enable = request.data.get('enable') if hasattr(request, 'data') and isinstance(request.data, dict) else None
            if explicit_enable is not None:
                enable_ai = bool(explicit_enable)
            else:
                # If contact is in human handoff, assigned/in_progress, or auto-reply is off,
                # toggling from the UI should TURN ON auto-reply and resolve the handoff.
                currently_ai_active = bool(
                    contact.is_auto_reply_enabled
                    and not contact.is_human_needed
                    and contact.support_status not in ['waiting_human', 'in_progress']
                )
                enable_ai = not currently_ai_active

            if enable_ai:
                _resolve_and_enable_ai(contact, request.user)
            else:
                contact.is_auto_reply_enabled = False
                contact.is_human_needed = True
                contact.support_status = 'in_progress'
                contact.waiting_since = None

            contact.save()
            serialized = ContactSerializer(contact).data
            return Response({
                "success": True,
                **serialized,
                "contact": serialized,
            }, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

class MessagePagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100

class ContactMessageHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, contact_id):
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            
            platform_val = contact.platform or ""
            identifier_val = contact.identifier or ""
            identifier_bare = identifier_val.replace('@s.whatsapp.net', '')

            # Query conversations flexibly to capture both legacy and new formats
            conversations = Conversation.objects.filter(
                agentAi=contact.agent,
                platform__iexact=platform_val
            )
            
            if platform_val.lower() == 'whatsapp':
                conversations = conversations.filter(
                    models.Q(contact_id__iexact=identifier_val) |
                    models.Q(contact_id__iexact=identifier_bare) |
                    models.Q(contact_id__iexact=f"{identifier_bare}@s.whatsapp.net")
                )
            else:
                conversations = conversations.filter(contact_id__iexact=identifier_val)

            if not conversations.exists():
                return Response({"messages": [], "count": 0}, status=status.HTTP_200_OK)

            unread_msgs = Message.objects.filter(conversation__in=conversations, role='user', is_read=False)
            if unread_msgs.exists():
                unread_msgs.update(is_read=True)

            messages = Message.objects.filter(conversation__in=conversations).order_by('-sent_at')
            
            paginator = MessagePagination()
            result_page = paginator.paginate_queryset(messages, request)
            serializer = MessageSerializer(result_page, many=True)
            
            return paginator.get_paginated_response(serializer.data)

        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _filter_contacts_for_scheduling(agent_qs, filters):
    qs = Contact.objects.filter(agent__in=agent_qs)

    contact_ids = filters.get('contact_ids') or []
    if isinstance(contact_ids, str):
        try:
            contact_ids = json.loads(contact_ids)
        except Exception:
            contact_ids = contact_ids.split(',') if contact_ids else []
    if contact_ids:
        try:
            contact_ids = [int(cid) for cid in contact_ids]
        except Exception:
            contact_ids = []
    if contact_ids:
        qs = qs.filter(id__in=contact_ids)

    platform = filters.get('platform')
    if platform:
        qs = qs.filter(platform=platform)

    start_date = filters.get('start_date')
    end_date = filters.get('end_date')
    contacts = list(qs.select_related('agent'))

    lead_stage = filters.get('lead_stage')
    filtered = []
    for c in contacts:
        mem = UserMemory.objects.filter(ai_agent=c.agent, sender_id=c.identifier).first()
        stage = (mem.data.get('lead_stage') if mem and isinstance(mem.data, dict) else None) or 'new'
        if contact_ids:
            # explicit selection; skip lead_stage filtering
            pass
        else:
            if lead_stage and lead_stage != 'all' and stage != lead_stage:
                continue
        if not contact_ids:
            # Date filter based on message timestamps (if provided)
            if start_date or end_date:
                msg_qs = Message.objects.filter(conversation__agentAi=c.agent, conversation__contact_id=c.identifier)
                if start_date:
                    try:
                        sd = datetime.fromisoformat(start_date)
                        msg_qs = msg_qs.filter(sent_at__gte=sd)
                    except Exception:
                        pass
                if end_date:
                    try:
                        ed = datetime.fromisoformat(end_date)
                        msg_qs = msg_qs.filter(sent_at__lte=ed)
                    except Exception:
                        pass
                if not msg_qs.exists():
                    continue

        # Only include contacts with some activity
        if not c.name and not c.push_name and not mem:
            continue
        filtered.append((c, stage))

    return filtered


@shared_task
def dispatch_scheduled_message(schedule_id):
    try:
        sched = ScheduledMessage.objects.select_related('agent').get(id=schedule_id)
        if sched.status != 'pending':
            return

        filters = sched.filter_payload or {}
        agent = sched.agent
        contacts_with_stage = _filter_contacts_for_scheduling([agent], filters)

        max_batch = sched.agent.schedule_max_batch or 500
        delay_ms = sched.agent.schedule_delay_ms or 0

        contacts_with_stage = contacts_with_stage[:max_batch]

        sent = 0
        with transaction.atomic():
            for contact, stage in contacts_with_stage:
                conv, _ = Conversation.objects.get_or_create(
                    agentAi=contact.agent,
                    contact_id=contact.identifier,
                    platform=contact.platform
                )
                Message.objects.create(
                    conversation=conv,
                    role='assistant',
                    content=sched.message,
                    platform=contact.platform
                )

                # attempt delivery per platform
                try:
                    if contact.platform == 'whatsapp':
                        data = {
                            "sender_id": contact.identifier,
                            "message_id": "",
                            "sessionId": f"user_{contact.agent.user.id}"
                        }
                        if deliver_whatsapp_reply(data, sched.message):
                            sent += 1
                    elif contact.platform in ['messenger', 'facebook_comment']:
                        if contact.agent.page_id and contact.agent.access_token:
                            if deliver_facebook_reply(
                                {"sender_id": contact.identifier},
                                sched.message,
                                contact.agent.page_id,
                                contact.agent.access_token
                            ):
                                sent += 1
                    elif contact.platform == 'instagram':
                        if contact.agent.page_id and contact.agent.access_token:
                            if deliver_instagram_reply(
                                {"sender_id": contact.identifier},
                                sched.message,
                                contact.agent.page_id,
                                contact.agent.access_token
                            ):
                                sent += 1
                    elif contact.platform == 'telegram':
                        token = None
                        bot = TelegramBot.objects.filter(agent=contact.agent, is_active=True).first()
                        if bot and bot.bot_token:
                            token = bot.bot_token
                        if token:
                            if deliver_telegram_reply(
                                {"sender_id": contact.identifier, "chat_id": contact.identifier},
                                sched.message,
                                token
                            ):
                                sent += 1
                    else:
                        # platforms we don't deliver, still count as logged
                        sent += 1
                except Exception as send_err:
                    logger.error(f"Scheduled delivery failed for contact {contact.id}: {send_err}")

                if delay_ms > 0:
                    import time
                    time.sleep(delay_ms / 1000.0)

            sched.status = 'sent'
            sched.audience_count = sent
            sched.save(update_fields=['status', 'audience_count', 'updated_at'])
    except Exception as e:
        ScheduledMessage.objects.filter(id=schedule_id).update(
            status='failed',
            error_message=str(e),
            updated_at=timezone.now()
        )


class ScheduledMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sched_id = request.GET.get('id')
        status_q = request.GET.get('status')
        run_after = request.GET.get('run_after')
        run_before = request.GET.get('run_before')

        qs = ScheduledMessage.objects.filter(agent__user=request.user)
        if sched_id:
            qs = qs.filter(id=sched_id)
        if status_q and status_q in dict(ScheduledMessage.STATUS_CHOICES):
            qs = qs.filter(status=status_q)
        if run_after:
            try:
                ra = datetime.fromisoformat(run_after)
                if timezone.is_naive(ra):
                    ra = timezone.make_aware(ra, timezone.get_current_timezone())
                qs = qs.filter(run_at__gte=ra)
            except Exception:
                pass
        if run_before:
            try:
                rb = datetime.fromisoformat(run_before)
                if timezone.is_naive(rb):
                    rb = timezone.make_aware(rb, timezone.get_current_timezone())
                qs = qs.filter(run_at__lte=rb)
            except Exception:
                pass

        qs = qs.order_by('-run_at')[:200]

        if sched_id:
            obj = qs.first()
            if not obj:
                return Response({"error": "Not found"}, status=404)
            ser = ScheduledMessageSerializer(obj)
        else:
            ser = ScheduledMessageSerializer(qs, many=True)
        return Response(ser.data, status=200)

    def post(self, request):
        data = request.data
        agent_id = data.get('agent_id')
        message = data.get('message', '').strip()
        run_at = data.get('run_at')
        filters = data.get('filters', {}) or {}

        if not agent_id or not message or not run_at:
            return Response({"error": "agent_id, message এবং run_at আবশ্যক"}, status=400)

        try:
            agent = AgentAI.objects.get(user=request.user, id=agent_id) if str(agent_id).isdigit() else AgentAI.objects.get(user=request.user, page_id=agent_id)
        except AgentAI.DoesNotExist:
            return Response({"error": "Agent not found"}, status=404)

        try:
            run_time = datetime.fromisoformat(run_at)
            if timezone.is_naive(run_time):
                run_time = timezone.make_aware(run_time, timezone.get_current_timezone())
        except Exception:
            return Response({"error": "run_at invalid ISO datetime"}, status=400)

        if run_time < timezone.now():
            return Response({"error": "run_at must be in the future"}, status=400)

        # quick audience count
        contacts_with_stage = _filter_contacts_for_scheduling([agent], filters)
        audience_count = len(contacts_with_stage)

        try:
            with transaction.atomic():
                consumed_sub = deduct_schedule_quota(request.user.profile, audience_count or 1)

                sched = ScheduledMessage.objects.create(
                    agent=agent,
                    message=message,
                    run_at=run_time,
                    filter_payload=filters,
                    audience_count=audience_count,
                    status='pending',
                    consumed_subscription=consumed_sub,
                    consumed_quota=audience_count or 1
                )
        except ValueError as e:
            return Response({"error": str(e)}, status=402)
        except Exception as e:
            return Response({"error": f"Scheduling failed: {e}"}, status=500)

        dispatch_scheduled_message.apply_async(args=[sched.id], eta=run_time)

        return Response({
            "success": True,
            "scheduled_id": sched.id,
            "audience_count": audience_count
        }, status=201)

    def delete(self, request):
        sched_id = request.data.get('id') or request.query_params.get('id')
        if not sched_id:
            return Response({"error": "id required"}, status=400)
        sched = ScheduledMessage.objects.filter(id=sched_id, agent__user=request.user).first()
        if not sched:
            return Response({"error": "Not found"}, status=404)
        if sched.status in ['sent', 'pending', 'failed']:
            if sched.status == 'pending' and sched.consumed_quota:
                try:
                    restore_schedule_quota(request.user.profile, sched.consumed_subscription, sched.consumed_quota)
                except Exception as e:
                    logger.error(f"Schedule quota restore failed for {sched_id}: {e}")
            sched.delete()
            return Response({"success": True}, status=200)
        return Response({"error": "Cannot delete this status"}, status=400)

    def patch(self, request):
        sched_id = request.data.get('id')
        if not sched_id:
            return Response({"error": "id required"}, status=400)
        sched = ScheduledMessage.objects.filter(id=sched_id, agent__user=request.user).first()
        if not sched:
            return Response({"error": "Not found"}, status=404)
        if sched.status != 'pending':
            return Response({"error": "Only pending schedules can be updated"}, status=400)

        message = request.data.get('message')
        run_at = request.data.get('run_at')
        filters = request.data.get('filters')

        if message:
            sched.message = message.strip()
        if run_at:
            try:
                rt = datetime.fromisoformat(run_at)
                if timezone.is_naive(rt):
                    rt = timezone.make_aware(rt, timezone.get_current_timezone())
                sched.run_at = rt
            except Exception:
                return Response({"error": "run_at invalid ISO datetime"}, status=400)
        if isinstance(filters, dict):
            sched.filter_payload = filters

        sched.save(update_fields=['message', 'run_at', 'filter_payload', 'updated_at'])
        return Response(ScheduledMessageSerializer(sched).data, status=200)

class UnifiedReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        contact_id = request.data.get('contact_id')
        message_text = request.data.get('message')
        is_internal_note = bool(request.data.get('is_internal_note'))

        if not contact_id or not message_text:
            return Response({"error": "contact_id and message are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            agent = contact.agent
            platform = contact.platform
            identifier = contact.identifier

            # ── 1. Internal Team Note (Never delivered to customer) ──
            if is_internal_note:
                from chat.models import Conversation, Message
                conv = Conversation.objects.filter(agentAi=agent, contact_id__iexact=identifier).first()
                if not conv:
                    conv = Conversation.objects.create(agentAi=agent, contact_id=identifier, platform=platform)
                Message.objects.create(
                    conversation=conv,
                    role='assistant',
                    content=message_text,
                    is_internal_note=True,
                    sent_by_user=request.user,
                    sender_name=request.user.name or request.user.email.split('@')[0],
                )
                contact.updated_at = timezone.now()
                contact.save(update_fields=['updated_at'])
                return Response({"success": True, "is_internal_note": True}, status=status.HTTP_200_OK)

            # ── 2. Direct Reply to Customer ──
            # When a human agent replies manually, pause AI to prevent overlapping
            contact.is_auto_reply_enabled = False
            contact.is_human_needed = True
            contact.waiting_since = None
            contact.support_status = 'in_progress'
            if not contact.assigned_to and not contact.assigned_by:
                tm = request.user.get_active_team_member()
                if tm and tm.owner_id == owner.id:
                    contact.assigned_to = tm
                contact.assigned_by = request.user
                contact.assigned_at = timezone.now()
            contact.save()

            from aiAgent.business_logic import logic_handler
            from chat.services import save_message
            
            success = False
            if platform == 'whatsapp':
                # For WhatsApp, Baileys/n8n expects sessionId as 'user_{user_id}'
                data = {
                    'sender_id': identifier,
                    'delivery_jid': identifier,
                    'sessionId': f"user_{agent.user.id}",
                    'phone': identifier,
                }
                success = logic_handler.deliver_whatsapp_reply(data, message_text)
            elif platform == 'messenger' or platform == 'facebook_comment':
                from users.models import FacebookPage
                fb_page = FacebookPage.objects.filter(page_id=agent.page_id, is_active=True).first()
                effective_token = fb_page.access_token if fb_page else agent.access_token
                data = {
                    'sender_id': identifier,
                    'type': platform
                }
                success = logic_handler.deliver_facebook_reply(data, message_text, agent.page_id, effective_token)
            elif platform == 'instagram':
                from users.models import FacebookPage
                fb_page = FacebookPage.objects.filter(page_id=agent.page_id, is_active=True).first()
                effective_token = fb_page.access_token if fb_page else agent.access_token
                data = {
                    'sender_id': identifier,
                    'type': platform
                }
                success = logic_handler.deliver_instagram_reply(data, message_text, agent.page_id, effective_token)
            elif platform in ['web_widget', 'web', 'shop']:
                 logic_handler.deliver_dashboard_reply(request.user.id, message_text, str(uuid.uuid4()))
                 success = True
            elif platform == 'telegram':
                 token = None
                 bot = TelegramBot.objects.filter(agent=agent, is_active=True).first()
                 if bot and bot.bot_token:
                     token = bot.bot_token
                 if token:
                     success = logic_handler.deliver_telegram_reply(
                         {"sender_id": identifier, "chat_id": identifier},
                         message_text,
                         token
                     )
            
            if success:
                # Save the manual reply in history
                save_message(agent, identifier, message_text, 'assistant', platform=platform)
                contact.updated_at = timezone.now()
                contact.save(update_fields=['updated_at'])
                serialized = ContactSerializer(contact).data
                return Response({
                    "success": True,
                    **serialized,
                    "contact": serialized,
                }, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Failed to deliver message to platform"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ResolveHumanHandoffView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            _resolve_and_enable_ai(contact, request.user)
            contact.save()
            serialized = ContactSerializer(contact).data
            return Response({
                "success": True,
                **serialized,
                "contact": serialized,
            }, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)


class ContactAssignView(APIView):
    """Claim, forward, auto-assign, or unassign customer chat with support for departments & instructions."""
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        owner = request.user.get_workspace_owner()
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

        mode = request.data.get("mode") or "claim"  # claim | assign | auto | unassign
        department = request.data.get("department") or ""
        note = (request.data.get("note") or "").strip()

        from users.models import TeamMember
        from django.utils import timezone

        if mode == "claim":
            tm = request.user.get_active_team_member()
            if tm and tm.owner_id == owner.id:
                contact.assigned_to = tm
            else:
                contact.assigned_to = None
            contact.assigned_by = request.user
            contact.assigned_at = timezone.now()
            contact.support_status = "in_progress"
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.waiting_since = None
            contact.save()

        elif mode == "assign":
            member_id = request.data.get("member_id")
            if not member_id:
                return Response({"error": "টিম মেম্বার নির্বাচন করুন"}, status=status.HTTP_400_BAD_REQUEST)
            try:
                tm = TeamMember.objects.get(id=member_id, owner=owner, is_active=True)
            except TeamMember.DoesNotExist:
                return Response({"error": "টিম মেম্বার পাওয়া যায়নি"}, status=status.HTTP_404_NOT_FOUND)

            contact.assigned_to = tm
            contact.assigned_by = request.user
            contact.assigned_at = timezone.now()
            contact.assigned_department = department or tm.department
            contact.assignment_note = note
            contact.support_status = "in_progress"
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.waiting_since = None
            contact.save()

            if note:
                from chat.models import Conversation, Message
                conversations = Conversation.objects.filter(agentAi=contact.agent, contact_id__iexact=contact.identifier)
                conv = conversations.first()
                if conv:
                    Message.objects.create(
                        conversation=conv,
                        role="assistant",
                        content=f"📌 ফরওয়ার্ড নির্দেশনা ({tm.user.name or tm.user.email}): {note}",
                        is_internal_note=True,
                        sent_by_user=request.user,
                        sender_name=request.user.name or request.user.email.split('@')[0],
                    )

        elif mode == "auto":
            from django.db.models import Count, Q
            qs = TeamMember.objects.filter(owner=owner, is_active=True, availability_status="online")
            if department and department != "all":
                qs = qs.filter(Q(department="all") | Q(department__icontains=department))

            qs = qs.filter(Q(allowed_agents__isnull=True) | Q(allowed_agents=contact.agent)).distinct()
            qs = qs.annotate(active_chat_count=Count('assigned_contacts', filter=Q(assigned_contacts__support_status='in_progress'))).order_by('active_chat_count', 'last_assigned_at')
            assigned_tm = qs.first()
            if not assigned_tm:
                return Response({"error": "এই মুহূর্তে কোনো অনলাইন টিম মেম্বার খালি পাওয়া যায়নি। ম্যানুয়ালি বেছে নিন।"}, status=status.HTTP_400_BAD_REQUEST)

            contact.assigned_to = assigned_tm
            contact.assigned_by = request.user
            contact.assigned_at = timezone.now()
            contact.assigned_department = department or assigned_tm.department
            contact.assignment_note = note
            contact.support_status = "in_progress"
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.waiting_since = None
            contact.save()
            assigned_tm.last_assigned_at = timezone.now()
            assigned_tm.save(update_fields=['last_assigned_at'])

        elif mode == "unassign":
            contact.assigned_to = None
            contact.assigned_by = None
            contact.assigned_department = ""
            contact.assignment_note = ""
            contact.support_status = "waiting_human"
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            if not contact.waiting_since:
                contact.waiting_since = timezone.now()
            contact.save()

        serializer = ContactSerializer(contact)
        return Response({"success": True, "contact": serializer.data}, status=status.HTTP_200_OK)

class HumanHelpView(APIView):
    """Marks contact as needing human help and disables AI auto-reply"""
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        try:
            owner = request.user.get_workspace_owner()
            contact = Contact.objects.get(id=contact_id, agent__user=owner)
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.support_status = "waiting_human"
            if not contact.waiting_since:
                contact.waiting_since = timezone.now()
            contact.save()
            serialized = ContactSerializer(contact).data
            return Response({
                "success": True, 
                **serialized,
                "contact": serialized,
            }, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)


class WhatsAppButtonClickView(APIView):
    """Public view to handle button clicks via links for WhatsApp fallback"""
    permission_classes = [AllowAny]

    def get(self, request):
        contact_id = request.GET.get('cid')
        action = request.GET.get('act')
        
        if not contact_id or not action:
            return Response({"error": "Invalid request parameters"}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            # We use the internal database ID for simplicity, 
            # ideally this should be a UUID or signed token in production.
            contact = Contact.objects.get(id=contact_id)
            
            if action == 'HUMAN_HELP':
                contact.is_human_needed = True
                contact.is_auto_reply_enabled = False
                contact.support_status = 'waiting_human'
                if not contact.waiting_since:
                    contact.waiting_since = timezone.now()
                msg = "🙋 Human Help: A human agent has been notified and AI is paused."
            elif action == 'STOP_AI_REPLY':
                contact.is_auto_reply_enabled = False
                contact.is_human_needed = True
                contact.support_status = 'in_progress'
                msg = "🔇 Stop AI: Auto-reply has been disabled for this conversation."
            elif action in ['ON_AI_REPLY', 'RESOLVE_HUMAN']:
                _resolve_and_enable_ai(contact)
                msg = "▶️ Start AI: Auto-reply has been re-enabled."
            else:
                return Response({"error": "Unknown action"}, status=status.HTTP_400_BAD_REQUEST)
                
            contact.save()

            # Simple text response for now, can be a template later
            return Response({
                "success": True, 
                "message": msg,
                "contact": contact.name or contact.identifier
            }, status=status.HTTP_200_OK)
            
        except Contact.DoesNotExist:
            return Response({"error": "Link expired or invalid"}, status=status.HTTP_404_NOT_FOUND)
