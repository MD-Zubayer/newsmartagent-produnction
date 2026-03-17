import logging
import secrets
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.views.decorators.csrf import csrf_exempt
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes

from .models import WhatsAppInstance, WhatsAppMessage
from .services import fetch_baileys_status

# সঠিক ইউজার মডেল পাওয়ার জন্য
User = get_user_model()

logger = logging.getLogger('openwa')

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def whatsapp_sync_agent(request):
    """
    Baileys সার্ভিস থেকে কল আসে যখন একটি সেশন কানেক্ট হয়।
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
        # টাইপ সেফটির জন্য str() ব্যবহার এবং আইডি আলাদা করা
        user_id = str(session_id).replace('user_', '')
        user = User.objects.get(id=user_id)
        
        from aiAgent.models import AgentAI
        
        # AgentAI তৈরি বা আপডেট
        agent, created = AgentAI.objects.update_or_create(
            page_id=phone,
            defaults={
                'user': user,
                'platform': 'whatsapp',
                'name': f"WhatsApp Agent ({phone})",
                'system_prompt': "You are an AI assistant for WhatsApp. Help users with their queries.",
                'ai_model': 'gemini-1.5-flash', # বর্তমান স্ট্যাবল ভার্সন
                'is_active': True,
                'number': phone,
                # WhatsApp এজেন্টের জন্য dummy token রাখা হচ্ছে যাতে required field pass করে।
                'access_token': f"whatsapp-auto-{secrets.token_urlsafe(8)}",
            }
        )
        
        # WhatsAppInstance আপডেট
        instance, _ = WhatsAppInstance.objects.update_or_create(
            user=user,
            defaults={
                'phone_number': phone,
                'status': 'open',
                'instance_name': data.get('pushName', 'default'),
                'baileys_api_url': settings.BAILEYS_API_URL,
            }
        )

        logger.info("WhatsApp sync successful for user %s (agent %s, created=%s)", user.id, agent.id, created)
        return Response({
            'success': True, 
            'agent_id': agent.id,
            'created': created
        })
    except User.DoesNotExist:
        return Response({'error': f'User {user_id} not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

# বাকি ফাংশনগুলো (init_session, SendView, StatusView, QRView) 
# আপনার দেওয়া কোড অনুযায়ী একদম ঠিক আছে। শুধু সেশন আইডি ইউআরএলগুলো ঠিকমতো পাস হচ্ছে কি না নিশ্চিত করুন।

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
    """
    permission_classes = [AllowAny] 

    def post(self, request):
        data = request.data
        # ১. n8n এবং manual body—উভয় ক্ষেত্র থেকে ডাটা রিসিভ করার ব্যবস্থা
        to = data.get('to') or data.get('sender_id') or data.get('phone')
        message = data.get('message') or data.get('reply')
        session_id = data.get('sessionId')

        # ২. সেশন আইডি না থাকলে রিকোয়েস্ট ইউজার থেকে নেওয়া (ড্যাশবোর্ড টেস্টের জন্য)
        if not session_id and request.user.is_authenticated:
            session_id = f"user_{request.user.id}"

        if not all([to, message, session_id]):
            return Response(
                {'error': '`to` (or sender_id), `message`, and `sessionId` are required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ৩. গুরুত্বপূর্ণ: নম্বর ফরম্যাটিং (Baileys এর জন্য @s.whatsapp.net যোগ করা)
        # যদি নম্বরটি শুধু ডিজিট হয়, তবে ফরম্যাট ঠিক করে দেওয়া
        clean_to = str(to).split('@')[0]  # যদি আগে থেকেই @ থাকে তা পরিষ্কার করা
        formatted_to = f"{clean_to}@s.whatsapp.net"
        logger.info(f"🔗 [View] Incoming data from n8n: {data}")
        logger.info(f"🔗 [View] Target: {to}, Formatted: {formatted_to}, Session: {session_id}")

        try:
            logger.info(f"📤 [View] Forwarding to Baileys: {settings.BAILEYS_API_URL}/send-message")
            response = requests.post(
                f'{settings.BAILEYS_API_URL}/send-message',
                json={
                    'sessionId': session_id,
                    'to': formatted_to, # ফরম্যাটেড নম্বর পাঠানো হচ্ছে
                    'message': message
                },
                headers={
                    'Content-Type': 'application/json',
                    'x-api-secret': settings.BAILEYS_API_SECRET,
                },
                timeout=15, # টাইমআউট কিছুটা বাড়ানো হলো
            )
            response.raise_for_status()
            res_data = response.json()
            logger.info(f"📊 [View] Baileys response: {res_data}")

            # Message log করুন
            WhatsAppMessage.objects.create(
                direction='outgoing',
                from_phone='bot',
                to_phone=clean_to,
                message_text=message,
                ai_reply=message,
            )

            logger.info(f'WhatsApp message successfully sent to {formatted_to} (Session: {session_id})')
            return Response(res_data, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException as e:
            logger.error(f'Baileys API Error: {str(e)}')
            return Response(
                {'error': 'Failed to communicate with Baileys service', 'details': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )


class WhatsAppStatusView(APIView):
    """
    Baileys WhatsApp connection status চেক করে।
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session_id = f"user_{request.user.id}"
        db_instance = WhatsAppInstance.objects.filter(user=request.user).first()
        db_state = db_instance.status if db_instance else 'close'
        db_phone = db_instance.phone_number if db_instance else None

        baileys_state, baileys_phone, baileys_status_code = fetch_baileys_status(session_id)

        # Pick the best-known state, preferring live Baileys data when available
        final_state = baileys_state or db_state
        final_phone = baileys_phone or db_phone

        if db_instance and (db_instance.status != final_state or (final_phone and db_instance.phone_number != final_phone)):
            db_instance.status = final_state
            if final_phone:
                db_instance.phone_number = final_phone
            db_instance.save(update_fields=['status', 'phone_number', 'updated_at'])

        # If Baileys says the session is missing but DB thinks it's open, reset DB status
        if baileys_status_code == 404 and db_instance and db_instance.status != 'close':
            db_instance.status = 'close'
            db_instance.save(update_fields=['status', 'updated_at'])
            final_state = 'close'

        response_payload = {
            'state': final_state,
            'phone': final_phone,
            'source': {
                'database': db_state,
                'baileys': baileys_state or ('unreachable' if baileys_status_code is None else baileys_state)
            }
        }

        if baileys_state is None and baileys_status_code is None:
            # Baileys unreachable but return latest DB state so dashboard stays responsive.
            response_payload['source']['baileys'] = 'unreachable'
            return Response(response_payload, status=status.HTTP_200_OK)

        return Response(response_payload, status=status.HTTP_200_OK)


class WhatsAppQRView(APIView):
    """
    Baileys QR code দেখায় (browser থেকে scan করার জন্য)।
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session_id = f"user_{request.user.id}"
        try:
            response = requests.get(
                f'{settings.BAILEYS_API_URL}/qr/{session_id}',
                timeout=5,
            )
            return Response(response.json(), status=response.status_code)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
