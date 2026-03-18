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
            agent = AgentAI.objects.get(page_id=agent_id, user=request.user)
            contacts = Contact.objects.filter(agent=agent).order_by('-updated_at')
            serializer = ContactSerializer(contacts, many=True)
            return Response({"contacts": serializer.data}, status=status.HTTP_200_OK)
        except AgentAI.DoesNotExist:
            return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)

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

            messages = Message.objects.filter(conversation=conversation).order_by('-sent_at')
            
            paginator = MessagePagination()
            result_page = paginator.paginate_queryset(messages, request)
            serializer = MessageSerializer(result_page, many=True)
            
            return paginator.get_paginated_response(serializer.data)

        except Contact.DoesNotExist:
            return Response({"error": "Contact not found"}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
