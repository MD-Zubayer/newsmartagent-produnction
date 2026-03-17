import os
import requests
import logging
from django.conf import settings
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes

from .models import WhatsAppInstance, WhatsAppMessage

logger = logging.getLogger('openwa')


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def whatsapp_sync_agent(request):
    """
    Baileys সার্ভিস থেকে কল আসে যখন একটি সেশন কানেক্ট হয়।
    এটি অটোমেটিক AgentAI তৈরি করে।
    """
    data = request.data
    session_id = data.get('sessionId')
    phone = data.get('phone')
    secret = data.get('secret')

    if secret != settings.BAILEYS_API_SECRET:
        return Response({'error': 'Unauthorized'}, status=401)

    if not all([session_id, phone]):
        return Response({'error': 'Missing data'}, status=400)

    try:
        # sessionId ইউজার আইডি হিসেবে ব্যবহৃত হচ্ছে (user_123 format or direct ID)
        user_id = session_id.replace('user_', '')
        user = User.objects.get(id=user_id)
        
        from aiAgent.models import AgentAI
        # Check if agent exists for this phone
        agent, created = AgentAI.objects.get_or_create(
            user=user,
            platform='whatsapp',
            page_id=phone,
            defaults={
                'name': f"WhatsApp Agent ({phone})",
                'system_prompt': "You are an AI assistant for WhatsApp. Help users with their queries.",
                'ai_model': 'gemini-1.5-flash',
                'is_active': True
            }
        )
        
        # Update WhatsAppInstance status
        instance, _ = WhatsAppInstance.objects.update_or_create(
            user=user,
            defaults={
                'phone_number': phone,
                'status': 'open',
                'instance_name': data.get('pushName', 'default')
            }
        )

        return Response({
            'success': True, 
            'agent_id': agent.id,
            'created': created
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def whatsapp_init_session(request):
    """
    ড্যাশবোর্ড থেকে সেশন ইনিশিয়ালাইজ করতে।
    """
    user = request.user
    session_id = f"user_{user.id}"
    baileys_url = settings.BAILEYS_API_URL

    try:
        response = requests.post(
            f"{baileys_url}/init/{session_id}",
            json={},
            timeout=10
        )
        return Response(response.json(), status=response.status_code)
    except Exception as e:
        return Response({'error': str(e)}, status=500)


class WhatsAppSendView(APIView):
    """
    n8n থেকে AI reply receive করে Baileys-এ forward করে।

    POST /api/whatsapp/send/
    Body: { "to": "880XXXXXXXXX", "message": "AI reply..." }
    Header: X-Api-Secret: <secret>  (optional অতিরিক্ত security layer)
    """
    permission_classes = [AllowAny] 

    def post(self, request):
        # existing send logic with sessionId logic
        data = request.data
        to = data.get('to')
        message = data.get('message')

        if not to or not message:
            return Response(
                {'error': '`to` and `message` are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = requests.post(
                f'{settings.BAILEYS_API_URL}/send-message',
                json={'to': to, 'message': message},
                headers={
                    'Content-Type': 'application/json',
                    'x-api-secret': settings.BAILEYS_API_SECRET,
                },
                timeout=10,
            )
            response.raise_for_status()
            data = response.json()

            # Message log করুন
            WhatsAppMessage.objects.create(
                direction='outgoing',
                from_phone='bot',
                to_phone=to,
                message_text=message,
                ai_reply=message,
            )

            logger.info(f'WhatsApp message sent to {to}')
            return Response(data, status=status.HTTP_200_OK)

        except requests.exceptions.ConnectionError:
            logger.error('Baileys service not reachable')
            return Response(
                {'error': 'Baileys service is not running'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except requests.exceptions.Timeout:
            logger.error('Baileys service timeout')
            return Response(
                {'error': 'Baileys service timeout'},
                status=status.HTTP_504_GATEWAY_TIMEOUT,
            )
        except requests.exceptions.HTTPError as e:
            logger.error(f'Baileys error: {e}')
            return Response(
                {'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class WhatsAppStatusView(APIView):
    """
    Baileys WhatsApp connection status চেক করে।

    GET /api/whatsapp/status/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            response = requests.get(
                f'{BAILEYS_API_URL}/status',
                timeout=5,
            )
            data = response.json()
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'status': 'unreachable', 'error': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class WhatsAppQRView(APIView):
    """
    Baileys QR code দেখায় (browser থেকে scan করার জন্য)।

    GET /api/whatsapp/qr/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        try:
            response = requests.get(
                f'{BAILEYS_API_URL}/qr',
                timeout=5,
            )
            data = response.json()
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
