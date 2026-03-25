from django.db import models
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import AgentAI, Contact
from .serializers import ContactSerializer, MessageSerializer
from chat.models import Conversation, Message
from rest_framework.pagination import PageNumberPagination

class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, agent_id):
        try:
            query = request.GET.get('q', '')
            
            if agent_id == 'all':
                # Fetch contacts for all agents of this user
                contacts = Contact.objects.filter(agent__user=request.user).order_by('-updated_at')
            else:
                if agent_id.isdigit():
                    agent = AgentAI.objects.get(id=int(agent_id), user=request.user)
                else:
                    agent = AgentAI.objects.get(models.Q(page_id=agent_id) | models.Q(number=agent_id), user=request.user)
                contacts = Contact.objects.filter(agent=agent).order_by('-updated_at')
            
            if query:
                contacts = contacts.filter(
                    models.Q(name__icontains=query) | 
                    models.Q(push_name__icontains=query) | 
                    models.Q(identifier__icontains=query)
                )
                
            serializer = ContactSerializer(contacts[:100], many=True)
            return Response({"contacts": serializer.data}, status=status.HTTP_200_OK)
        except AgentAI.DoesNotExist:
            return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)

class ContactDetailView(APIView):
    permission_classes = [IsAuthenticated]

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

import uuid
