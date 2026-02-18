from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification
from .utils import send_user_notification
from users.models import CustomerOrder
from users.serializers import CustomerOrderSerializer
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync



@receiver(post_save, sender=Notification)
def broadcast_notification(sender, instance, created, **kwargs):
    if created:
        send_user_notification(instance)
        print(f"📡 Broadcasted notification to User {instance.user.id}")


@receiver(post_save, sender=CustomerOrder)
def broadcast_order_to_frontend(sender, instance, created, **kwargs):
    
    if created:
        channel_layer = get_channel_layer()
        serializer = CustomerOrderSerializer(instance)

        async_to_sync(channel_layer.group_send)(
            f"user_{instance.user.id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "NEW_ORDER",
                    "order_data": serializer.data,
                    "message": "You have a new order!"
                }
            }
        )