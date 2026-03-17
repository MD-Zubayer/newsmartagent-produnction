# webhooks/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from webhooks.tasks import process_ai_reply_task
import hashlib
import logging
from aiAgent.cache.client import get_redis_client

logger = logging.getLogger(__name__)

# ডুপ্লিকেট webhook hit ব্লক করার জন্য Redis client
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = get_redis_client(db=0)
    return _redis_client

def _is_duplicate_webhook(sender_id, text, page_id):
    """
    একই sender_id + message + page_id এর জন্য 30 সেকেন্ডের মধ্যে
    দ্বিতীয় webhook hit হলে True রিটার্ন করবে।
    """
    try:
        r = _get_redis()
        # Hash: sender + message (first 100 chars) + page
        raw = f"{sender_id}:{str(text)[:100]}:{page_id}"
        hash_key = f"webhook_dedup:{hashlib.md5(raw.encode()).hexdigest()}"
        # nx=True: শুধু নতুন key set হবে, পুরনো থাকলে set হবে না
        is_new = r.set(hash_key, '1', nx=True, ex=30)
        return not is_new  # is_new=None মানে duplicate
    except Exception as e:
        logger.warning(f"⚠️ Webhook dedup Redis error: {e}")
        return False  # Redis error হলে proceed করতে দিন




@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def test_webhook(request):
    
    print('Incoming form n8n: ', request.data)

    return Response({'status': 'ok', 'message': 'django connected successfully'})



# recive data from n8n & return 202 ok

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_webhook(request):
    print("!!! REQUEST RECEIVED !!!")
    data = dict(request.data)
    print(data)
    # first validation
    sender_id = data.get('sender_id')
    page_id = data.get('page_id')
    request_type = data.get('type')

    # WhatsApp: allow fallback to receiver/sessionId/phone when page_id absent
    if request_type == 'whatsapp' and not page_id:
        page_id = data.get('receiver') or data.get('sessionId') or data.get('phone')

    # comment or message

    if request_type == 'facebook_comment':
        text = data.get('comment_text')
    else:
        # messenger or whatsapp
        text = data.get('message')

    if not all([sender_id, text, page_id]):
        print(f"Missing data: sender={sender_id}, text={text}, page={page_id}")
        return Response({'error': 'Missing data'}, status=400)

    if sender_id == page_id:
        print(f"⏭️ View Filter: Ignoring self-activity from {page_id}")
        return Response({'status': 'ignored'}, status=200)

    # 🔥 View-Level Deduplication: একই message 30s এর মধ্যে দ্বিতীয়বার এলে block করো
    if _is_duplicate_webhook(sender_id, text, page_id):
        logger.info(f"🔁 Duplicate webhook blocked for sender={sender_id}, text='{str(text)[:30]}'")
        return Response({'status': 'ignored', 'reason': 'duplicate'}, status=200)

    # send to celery

    
    try:
        process_ai_reply_task.delay(data)
        print(f">>> Task successfully sent to Celery for sender: {sender_id}")
        return Response({
             'status': 'accepted',
              'message': 'Task is processing is background'
            }, status=202)
    except Exception as e:
        # যদি রেডিস কানেকশন বা সিরিয়ালাইজেশন এরর হয়
        print(f"ERROR SENDING TO CELERY: {str(e)}")
        return Response({'error': 'Internal Task Queue Error'}, status=500)
