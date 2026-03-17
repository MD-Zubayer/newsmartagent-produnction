from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .models import AgentAI, Contact

class ContactListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, agent_id):
        try:
            agent = AgentAI.objects.get(page_id=agent_id, user=request.user)
            contacts = Contact.objects.filter(agent=agent).order_by('-updated_at')
            data = [
                {
                    "id": c.id,
                    "identifier": c.identifier,
                    "name": c.name,
                    "push_name": c.push_name,
                    "is_auto_reply_enabled": c.is_auto_reply_enabled,
                    "platform": c.platform,
                    "updated_at": c.updated_at
                }
                for c in contacts
            ]
            return Response({"contacts": data}, status=status.HTTP_200_OK)
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
