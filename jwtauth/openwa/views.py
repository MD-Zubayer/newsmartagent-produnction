import os
import requests
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from .models import WhatsAppInstance, WhatsAppMessage

logger = logging.getLogger('openwa')

BAILEYS_API_URL = os.environ.get('BAILEYS_API_URL', 'http://newsmartagent-baileys:3001')
BAILEYS_API_SECRET = os.environ.get('BAILEYS_API_SECRET', 'changeme123')


class WhatsAppSendView(APIView):
    """
    n8n থেকে AI reply receive করে Baileys-এ forward করে।

    POST /api/whatsapp/send/
    Body: { "to": "880XXXXXXXXX", "message": "AI reply..." }
    Header: X-Api-Secret: <secret>  (optional অতিরিক্ত security layer)
    """
    permission_classes = [AllowAny]  # n8n থেকে authenticated নয়, তাই AllowAny

    def post(self, request):
        to = request.data.get('to')
        message = request.data.get('message')

        if not to or not message:
            return Response(
                {'error': '`to` and `message` are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = requests.post(
                f'{BAILEYS_API_URL}/send-message',
                json={'to': to, 'message': message},
                headers={
                    'Content-Type': 'application/json',
                    'x-api-secret': BAILEYS_API_SECRET,
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
