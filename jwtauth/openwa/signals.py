from django.db.models.signals import pre_delete
from django.dispatch import receiver

from .models import WhatsAppInstance
from .services import stop_baileys_session_for_user


@receiver(pre_delete, sender=WhatsAppInstance)
def cleanup_baileys_session(sender, instance, **kwargs):
    """
    Ensure Baileys session is stopped/removed when an instance is deleted
    (covers admin deletes and any ORM delete).
    """
    stop_baileys_session_for_user(instance.user_id)
