from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

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
