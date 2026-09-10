from celery import shared_task
from django.utils import timezone

from .models import Collection


@shared_task(name="assunnah.cleanup_expired_collections")
def cleanup_expired_collections():
    deleted, _ = Collection.objects.filter(expires_at__lte=timezone.now()).delete()
    return deleted

