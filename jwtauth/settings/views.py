from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from .models import AgentSettings
from .serializers import AgentSettingsSerializer
import requests
import logging

logger = logging.getLogger(__name__)

class AgentSettingsDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AgentSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj, created = AgentSettings.objects.get_or_create(user=self.request.user)
        return obj

class PublicSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'support_email': settings.DEFAULT_FROM_EMAIL
        })

class TelegramBotSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from aiAgent.models import AgentAI
        
        token = request.data.get('token')
        agent_id = request.data.get('agent_id')
        
        if not token or not agent_id:
            return Response({'error': 'Token and agent_id are required'}, status=400)
        
        # Validate token with Telegram API
        try:
            response = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
            if response.status_code != 200:
                return Response({'error': 'Invalid bot token'}, status=400)
            
            bot_data = response.json()
            if not bot_data.get('ok'):
                return Response({'error': 'Invalid bot token'}, status=400)
            
            bot_username = bot_data['result']['username']
            
        except Exception as e:
            logger.error(f"Telegram token validation error: {e}")
            return Response({'error': 'Failed to validate token'}, status=500)
        
        # Get the agent
        try:
            agent = AgentAI.objects.get(id=agent_id, user=request.user, platform='telegram')
        except AgentAI.DoesNotExist:
            return Response({'error': 'Agent not found or not a Telegram agent'}, status=404)
        
        # Set webhook
        webhook_url = f"https://newsmartagent.com/api/webhooks/telegram/"  # Adjust domain as needed
        try:
            webhook_response = requests.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": webhook_url},
                timeout=10
            )
            if webhook_response.status_code != 200:
                logger.warning(f"Failed to set webhook: {webhook_response.text}")
                # Continue anyway, webhook can be set manually
        
        except Exception as e:
            logger.error(f"Webhook setup error: {e}")
            # Continue anyway
        
        # Save token and bot info
        agent.access_token = token
        agent.page_id = bot_username
        agent.save()
        
        return Response({
            'success': True,
            'bot_username': bot_username,
            'message': 'Telegram bot configured successfully'
        })
