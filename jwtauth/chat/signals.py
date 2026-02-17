from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification
from .utils import send_user_notification



@receiver(post_save, sender=Notification)
def broadcast_notification(sender, instance, created, **kwargs):
    if created:
        send_user_notification(instance)
        print(f"📡 Broadcasted notification to User {instance.user.id}")