from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from chat.serializer import ContactSerializer, NotificationSerializer
from chat.models import Notification
import base64
import hashlib
import hmac
import json
import logging
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from aiAgent.models import AgentAI 
from chat.models import Conversation
logger = logging.getLogger(__name__)
# Create your views here.


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def contact_create(request):
    serializer = ContactSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()

        return Response({
            "message": "Success! We received your message."}, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification(request):
    
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:20]
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_read(request, pk):
    try:
        notifcation = Notification.objects.get(pk=pk, user=request.user)
        notifcation.is_read = True
        notifcation.save()
        return Response({'status': 'success', 'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    return Response({'error': 'Something went wrong'}, status=400)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk):
    try:
        notification = Notification.objects.get(pk=pk, user=request.user)
        notification.delete()

        return Response({'status': 'success', 'message': 'Notification deleted successfully'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=404)


def parse_signed_request(signed_request, secret):
    try:
        encoded_sig, payload = signed_request.split('.', 2)
        sig = base64.urlsafe_b64decode(encoded_sig + '=' * (4 - len(encoded_sig) % 4))
        data = json.loads(base64.urlsafe_b64decode(payload + '=' * (4 - len(payload) % 4)).decode('utf-8'))

        expected_sig = hmac.new(secret.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        return data
    except Exception as e:
        logger.error(f"Signed Request Parsing Error: {e}")
        return None

@csrf_exempt
def facebook_data_deletion_callback(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    signed_request = request.POST.get('signed_request')
    if not signed_request:
        return JsonResponse({'error': 'No signed_request provided'}, status=400)

    # আপনার Facebook App Secret যা settings.py এ থাকা উচিত
    secret = getattr(settings, 'SOCIAL_AUTH_FACEBOOK_SECRET', None) 
    
    if not secret:
        logger.error("Facebook App Secret not found in settings.")
        return JsonResponse({'error': 'Server configuration error'}, status=500)

    data = parse_signed_request(signed_request, secret)
    if not data:
        return JsonResponse({'error': 'Invalid signed_request'}, status=400)

    user_id = data.get('user_id') # এটি ফেসবুকের Scoped User ID
    
    # ডাটা ডিলিশন লজিক
    try:
        # ১. ওই ইউজারের যদি নির্দিষ্ট কোনো AgentAI থাকে (page_id হিসেবে থাকলে)
        # অথবা আপনার প্রোফাইল মডেলে যদি ফেসবুক ইউজার আইডি সেভ করা থাকে তবে সেটি ফিল্টার করুন।
        
        # উদাহরণস্বরূপ: আমরা ওই ইউজারের সাথে যুক্ত সব এজেন্ট খুঁজে বের করছি
        agents = AgentAI.objects.filter(page_id=user_id) 
        
        # ২. এজেন্ট ডিলিট করলে Cascade অন করা থাকায় Conversation এবং Message অটো ডিলিট হবে
        agents.delete()
        
        logger.info(f"Data deleted successfully for FB User ID: {user_id}")

        confirm_code = f"del_confirm_{user_id}"
        # এই URL-টি আপনার Next.js এ বানানো কনফার্মেশন পেজ হবে
        status_url = f"https://newsmartagent.com/deletion-status/?id={confirm_code}"

        return JsonResponse({
            'url': status_url,
            'confirmation_code': confirm_code
        })

    except Exception as e:
        logger.error(f"Data Deletion Logic Error: {e}")
        return JsonResponse({'error': 'Internal deletion error'}, status=500)