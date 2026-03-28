from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework import status
from .models import AgentAI, Contact
from .serializers import ContactSerializer, MessageSerializer
from chat.models import Conversation, Message
from rest_framework.pagination import PageNumberPagination
from django.db.models import Count
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
                    agent = AgentAI.objects.get(id=int(agent_id), user=request.user)
                else:
                    agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=request.user)
                contacts = Contact.objects.filter(agent=agent)
            
            if query:
                contacts = contacts.filter(
                    models.Q(name__icontains=query) | 
                    models.Q(push_name__icontains=query) | 
                    models.Q(identifier__icontains=query)
                )

            # By default exclude YouTube contacts from the main list; allow explicit filter
            if comments_only:
                contacts = contacts.filter(platform='youtube')
            elif platform_filter:
                contacts = contacts.filter(platform=platform_filter)
            else:
                contacts = contacts.exclude(platform='youtube')

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
        data['messages'] = qs.exclude(platform='youtube').count()
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
