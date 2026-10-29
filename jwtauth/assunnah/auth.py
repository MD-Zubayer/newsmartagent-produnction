from datetime import timedelta

from django.utils import timezone

from .models import Collection


def active_collection(request):
    collection = Collection.objects.filter(expires_at__gt=timezone.now()).order_by("-created_at").first()
    if not collection:
        collection = Collection.objects.create(expires_at=timezone.now() + timedelta(days=60))
    return collection
