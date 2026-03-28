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
)
from aiAgent.models import TelegramBot
import uuid
class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, agent_id):
        try:
            query = request.GET.get('q', '')
            platform_filter = request.GET.get('platform')
            comments_only = request.GET.get('comments_only') == 'true'
            
            if agent_id == 'all':
                # Fetch contacts for all agents of this user
                contacts = Contact.objects.filter(agent__user=request.user)
            else:
                if agent_id.isdigit():
                    try:
                        agent = AgentAI.objects.get(id=int(agent_id), user=request.user)
                    except AgentAI.DoesNotExist:
                        agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=request.user)
                else:
                    agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=request.user)
                contacts = Contact.objects.filter(agent=agent)
            
            if query:
                contacts = contacts.filter(
                    models.Q(name__icontains=query) | 
                    models.Q(push_name__icontains=query) | 
                    models.Q(identifier__icontains=query)
                )

            comment_platforms = ['youtube', 'facebook_comment']

            # By default exclude comment platforms from the main list; allow explicit filter
            if comments_only:
                contacts = contacts.filter(platform__in=comment_platforms)
            elif platform_filter:
                contacts = contacts.filter(platform=platform_filter)
            else:
                contacts = contacts.exclude(platform__in=comment_platforms)

            contacts = contacts.order_by('-updated_at')
            serializer = ContactSerializer(contacts[:100], many=True)
            return Response({"contacts": serializer.data}, status=status.HTTP_200_OK)
        except AgentAI.DoesNotExist:
            return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)


class ContactSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = Contact.objects.filter(agent__user=request.user)
        summary = qs.values('platform').annotate(total=Count('id'))
        data = {item['platform']: item['total'] for item in summary}
        data.setdefault('youtube', 0)
        data.setdefault('facebook_comment', 0)
        data['comments'] = qs.filter(platform__in=['youtube', 'facebook_comment']).count()
        data['messages'] = qs.exclude(platform__in=['youtube', 'facebook_comment']).count()
        return Response(data, status=status.HTTP_200_OK)

class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, contact_id):
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            serializer = ContactSerializer(contact)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, contact_id):
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            
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
                serializer.save()
                return Response(serializer.data, status=status.HTTP_200_OK)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

class ToggleAutoReplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            contact.is_auto_reply_enabled = not contact.is_auto_reply_enabled
            contact.save()
            return Response({
                "success": True, 
                "is_auto_reply_enabled": contact.is_auto_reply_enabled
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
            
            # Find the conversation
            conversation = Conversation.objects.filter(
                agentAi=contact.agent,
                contact_id=contact.identifier,
                platform=contact.platform
            ).first()

            if not conversation:
                return Response({"messages": [], "count": 0}, status=status.HTTP_200_OK)

            unread_msgs = Message.objects.filter(conversation=conversation, role='user', is_read=False)
            if unread_msgs.exists():
                unread_msgs.update(is_read=True)

            messages = Message.objects.filter(conversation=conversation).order_by('-sent_at')
            
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
        if lead_stage and lead_stage != 'all' and stage != lead_stage:
            continue
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

        sched = ScheduledMessage.objects.create(
            agent=agent,
            message=message,
            run_at=run_time,
            filter_payload=filters,
            audience_count=audience_count,
            status='pending'
        )

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

        if not contact_id or not message_text:
            return Response({"error": "contact_id and message are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            agent = contact.agent
            platform = contact.platform
            identifier = contact.identifier

            # ── Auto-Reply Pause Logic ──
            # When a human agent replies manually, we pause the AI to prevent overlapping
            # Also clear the is_human_needed flag as the human has now responded.
            if contact.is_auto_reply_enabled or contact.is_human_needed:
                contact.is_auto_reply_enabled = False
                contact.is_human_needed = False
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
                # FacebookPage থেকে সর্বশেষ refreshed token নেওয়া হচ্ছে
                # AgentAI.access_token পুরনো হতে পারে; FacebookPage.access_token সবসময় আপডেট থাকে
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
            elif platform == 'web_widget':
                 # For Web Widget, save the message to history. The visitor sees it on next fetch/message.
                 # Also update the dashboard context via WebSocket.
                 success = logic_handler.deliver_dashboard_reply(request.user.id, message_text, str(uuid.uuid4()))
            
            if success:
                # Save the manual reply in history
                save_message(agent, identifier, message_text, 'assistant', platform=platform)
                return Response({"success": True}, status=status.HTTP_200_OK)
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
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            contact.is_human_needed = False
            contact.save()
            return Response({"success": True, "is_human_needed": False}, status=status.HTTP_200_OK)
        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)

class HumanHelpView(APIView):
    """Marks contact as needing human help and disables AI auto-reply"""
    permission_classes = [IsAuthenticated]

    def post(self, request, contact_id):
        try:
            contact = Contact.objects.get(id=contact_id, agent__user=request.user)
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.save()
            return Response({
                "success": True, 
                "is_human_needed": True,
                "is_auto_reply_enabled": False
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
                msg = "🙋 Human Help: A human agent has been notified and AI is paused."
            elif action == 'STOP_AI_REPLY':
                contact.is_auto_reply_enabled = False
                msg = "🔇 Stop AI: Auto-reply has been disabled for this conversation."
            elif action == 'ON_AI_REPLY':
                contact.is_auto_reply_enabled = True
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
