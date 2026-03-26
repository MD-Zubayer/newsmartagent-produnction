from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from .models import AgentSettings
from .serializers import AgentSettingsSerializer
import requests
import logging
import uuid

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
        
        if not token:
            return Response({'error': 'Token is required'}, status=400)
        
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

        agent = None
        if agent_id:
            agent = AgentAI.objects.filter(id=agent_id, user=request.user, platform='telegram').first()

        if not agent:
            # Auto-create agent if not found or not provided
            agent_name = request.data.get('name') or 'Telegram Agent'
            agent = AgentAI.objects.create(
                user=request.user,
                name=agent_name,
                platform='telegram',
                system_prompt=request.data.get('system_prompt', 'You are a helpful AI assistant for Telegram.'),
                greeting_message=request.data.get('greeting_message', 'Hello! How can I help you today?'),
                page_id=bot_username,
                access_token=token,
                ai_agent_type='support',
                is_active=True,
            )
        else:
            agent.access_token = token
            agent.page_id = bot_username
            agent.save()
        
        # Set webhook
        # Include bot_username in the webhook URL so incoming updates can be routed
        # to the correct custom bot without requiring a mapping fallback.
        webhook_url = f"https://newsmartagent.com/api/webhooks/telegram/?bot_username={bot_username}"
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

        # ✅ Save to TelegramBot model (required for webhook lookup & token delivery)
        try:
            from aiAgent.models import TelegramBot
            bot_name = bot_data['result'].get('first_name', bot_username)
            print(f"💾 [TelegramBotSetupView] Saving TelegramBot for agent={agent.id}, username=@{bot_username}, name={bot_name}")
            TelegramBot.objects.update_or_create(
                agent=agent,
                defaults={
                    'bot_token': token,
                    'bot_username': bot_username,
                    'bot_name': bot_name,
                    'is_active': True
                }
            )
            print(f"✅ [TelegramBotSetupView] TelegramBot record saved for @{bot_username}")
        except Exception as e:
            print(f"❌ [TelegramBotSetupView] Failed to save TelegramBot: {e}")
            logger.exception("TelegramBot save failed")
            # Don't fail the whole request — agent is already saved

        return Response({
            'success': True,
            'bot_username': bot_username,
            'message': 'Telegram bot configured successfully'
        })

class TelegramSharedBotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get all user's Telegram agents with shared bot links"""
        from aiAgent.models import AgentAI, TelegramBotMapping
        
        agents = AgentAI.objects.filter(
            user=request.user,
            platform='telegram',
            is_active=True
        )

        agent_data = []
        for agent in agents:
            # Generate deep link
            deep_link = f"https://t.me/NewSmartAgent_Bot?start=agent_{agent.id}"
            
            # Count connected chats
            chat_count = TelegramBotMapping.objects.filter(
                agent=agent,
                is_active=True
            ).count()
            
            agent_data.append({
                'id': agent.id,
                'name': agent.name,
                'deep_link': deep_link,
                'connected_chats': chat_count,
                'created_at': agent.created_at
            })
        
        return Response({
            'agents': agent_data,
            'shared_bot_username': '@NewSmartAgent_Bot'
        })

    def post(self, request):
        """Create a new Telegram agent for shared bot"""
        from aiAgent.models import AgentAI
        import uuid
        import logging
        logger = logging.getLogger(__name__)

        print(f"🚀 [SharedBotView] POST request from user: {request.user.email}")
        
        name = request.data.get('name', 'Telegram Agent')
        system_prompt = request.data.get('system_prompt', 'You are a helpful AI assistant for Telegram.')
        greeting_message = request.data.get('greeting_message', 'Hello! How can I help you today?')
        
        if not name:
            print("❌ [SharedBotView] Agent name missing")
            return Response({'error': 'Agent name is required'}, status=400)
        
        try:
            # Create agent
            agent = AgentAI.objects.create(
                user=request.user,
                name=name,
                platform='telegram',
                system_prompt=system_prompt,
                greeting_message=greeting_message,
                # 🔥 Important: page_id must match the format expected by the webhook lookup
                # Webhook expects "shared_agent_{agent.id}"
                # We'll set it to a temp value and update it after creation
                page_id=f'shared_agent_temp_{uuid.uuid4().hex[:8]}', 
                ai_agent_type='support'
            )
            
            # Now update page_id to the final format
            agent.page_id = f"shared_agent_{agent.id}"
            agent.save(update_fields=['page_id'])
            
            print(f"✅ [SharedBotView] Agent created: ID {agent.id}, name {agent.name}")

            # Generate deep link
            # Use @NewSmartAgent_Bot as the default shared bot
            deep_link = f"https://t.me/NewSmartAgent_Bot?start=agent_{agent.id}"
            
            return Response({
                'success': True,
                'agent': {
                    'id': agent.id,
                    'name': agent.name,
                    'deep_link': deep_link,
                    'connected_chats': 0
                },
                'message': 'Telegram agent created successfully'
            })
        except Exception as e:
            print(f"❌ [SharedBotView] Error creating agent: {e}")
            logger.exception("Shared bot agent creation failed")
            return Response({'error': str(e)}, status=500)
