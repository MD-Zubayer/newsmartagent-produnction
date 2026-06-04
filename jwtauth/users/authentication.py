from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth import get_user_model
from django.conf import settings
import os

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        device_token = request.COOKIES.get('trusted_device')

        if not raw_token:
            return None

        # If JWT is expired or invalid, return None (don't block AllowAny endpoints like /login/)
        try:
            validated_token = self.get_validated_token(raw_token)
        except Exception:
            return None

        try:
            user = self.get_user(validated_token)
        except Exception:
            return None

        # Remote Logout Check: If device_token cookie is present, verify it's still in the DB.
        # We return None (anonymous) instead of raising an error so that AllowAny endpoints
        # like /login/ are NOT blocked. Protected endpoints will still get 401 because
        # the user will be anonymous, triggering the frontend logout flow.
        if device_token:
            from users.models import TrustedDevice
            if not TrustedDevice.objects.filter(user=user, device_token=device_token).exists():
                return None  # Treat as unauthenticated → protected routes → 401 → frontend logout

        return user, validated_token


class InternalServiceAuthentication(CookieJWTAuthentication):
    """Authenticate internal service calls using shared header secrets or internal bearer tokens."""

    def authenticate(self, request):
        authenticated = super().authenticate(request)
        if authenticated:
            return authenticated

        api_secret = (
            getattr(settings, 'BAILEYS_API_SECRET', None)
            or os.environ.get('BAILEYS_API_SECRET')
        )
        internal_token = (
            getattr(settings, 'INTERNAL_API_TOKEN', None)
            or os.environ.get('INTERNAL_API_TOKEN')
        )

        secret_header = (
            request.headers.get('x-api-secret')
            or request.META.get('HTTP_X_API_SECRET')
        )
        auth_header = (
            request.headers.get('Authorization')
            or request.META.get('HTTP_AUTHORIZATION', '')
        )

        valid_secret = api_secret and secret_header and secret_header == api_secret
        valid_token = False
        if internal_token and auth_header:
            parts = auth_header.split()
            if len(parts) == 2 and parts[0].lower() == 'bearer' and parts[1] == internal_token:
                valid_token = True

        if not (valid_secret or valid_token):
            return None

        user_id_header = (
            request.headers.get('X-User-ID')
            or request.META.get('HTTP_X_USER_ID')
        )
        if not user_id_header:
            raise AuthenticationFailed('X-User-ID header required for internal authentication')

        try:
            user_id = int(user_id_header)
        except (TypeError, ValueError):
            raise AuthenticationFailed('Invalid X-User-ID header')

        User = get_user_model()
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise AuthenticationFailed('User not found for internal authentication')

        return user, None
