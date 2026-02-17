# /app/chat/utils.py

from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def send_user_notification(instance):
    from chat.serializer import NotificationSerializer

  
    
    
    # ৩. চ্যানেলে ব্রডকাস্টিং
    channel_layer = get_channel_layer()
    serializer = NotificationSerializer(instance)

    async_to_sync(channel_layer.group_send)(
        f"user_{instance.user.id}",
        {
            "type": "send_notification",
            "content": serializer.data
        }
    )
    
    
