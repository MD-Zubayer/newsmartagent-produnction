# webhooks/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from webhooks.tasks import process_ai_reply_task
# Create your views here.




@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def test_webhook(request):
    
    print('Incoming form n8n: ', request.data)

    return Response({'status': 'ok', 'message': 'django connected successfully'})



# recive data from n8n & return 202 ok

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_webhook(request):
    data = request.data

    # first validation
    sender_id = data.get('sender_id')
    page_id = data.get('page_id')

    # comment or message

    request_type = data.get('type')
    text = data.get('comment_text') if request_type == 'facebook_comment' else data.get('message')

    if not all([sender_id, text, page_id]):
        print(f"Missing data: sender={sender_id}, text={text}, page={page_id}")
        return Response({'error': 'Missing data'}, status=400)

    
    # send to celery
    process_ai_reply_task.delay(data)

    return Response({
        'status': 'accepted',
        'message': 'Task is processing is background'
    }, status=202)