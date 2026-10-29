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
    channel_layer = get_channel_layer()
    serializer = CustomerOrderSerializer(instance)

    if created:
        items_summary = ""
        if isinstance(instance.items, list) and len(instance.items) > 0:
            item_parts = []
            for itm in instance.items[:2]:
                if isinstance(itm, dict):
                    name = itm.get('name') or itm.get('product_name') or 'Item'
                    qty = itm.get('quantity') or 1
                    item_parts.append(f"{name} x{qty}")
            if len(instance.items) > 2:
                item_parts.append(f"+{len(instance.items) - 2} more")
            items_summary = ", ".join(item_parts)
        else:
            items_summary = f"{instance.product_name or 'Product'} x{instance.item_quantity}"

        msg = f"নতুন অর্ডার #{instance.id}: {instance.customer_name} — ৳{instance.price + (instance.delivery_charge or 0):g} ({items_summary})"

        # Persist notification in database
        try:
            Notification.objects.create(
                user=instance.user,
                message=msg,
                type="order_created"
            )
        except Exception as e:
            print(f"Error saving order Notification: {e}")

        # Broadcast NEW_ORDER event to WebSocket
        async_to_sync(channel_layer.group_send)(
            f"user_{instance.user.id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "NEW_ORDER",
                    "order_data": serializer.data,
                    "message": msg
                }
            }
        )
    else:
        # If status updated to cancelled
        if instance.status == 'cancelled':
            msg = f"অর্ডার #{instance.id} বাতিল হয়েছে: {instance.customer_name} অর্ডারটি বাতিল করেছেন।"
            try:
                Notification.objects.create(
                    user=instance.user,
                    message=msg,
                    type="order_cancelled"
                )
            except Exception as e:
                print(f"Error saving order cancel Notification: {e}")

            async_to_sync(channel_layer.group_send)(
                f"user_{instance.user.id}",
                {
                    "type": "send_notification",
                    "content": {
                        "action": "ORDER_CANCELLED",
                        "order_data": serializer.data,
                        "message": msg
                    }
                }
            )