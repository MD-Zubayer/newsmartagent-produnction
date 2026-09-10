import os

from django.core import signing
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed

from .models import Collection

COOKIE_NAME = "as_sunnah_access"


def active_collection(request):
    token = request.COOKIES.get(COOKIE_NAME)
    if not token:
        raise AuthenticationFailed("As-Sunnah password required")
    try:
        data = signing.loads(token, salt="as-sunnah-access", max_age=60 * 60 * 24 * 60)
        collection = Collection.objects.get(pk=data["collection_id"])
    except (signing.BadSignature, signing.SignatureExpired, Collection.DoesNotExist, KeyError):
        raise AuthenticationFailed("Access expired. Please enter the password again.")
    if collection.expires_at <= timezone.now():
        collection.delete()
        raise AuthenticationFailed("This collection has expired.")
    return collection


def password_is_valid(password):
    configured = os.getenv("AS_SUNNAH_ACCESS_PASSWORD", "").strip()
    return bool(configured and password and password == configured)

