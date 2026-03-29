from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.exceptions import AuthenticationFailed

class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        raw_token = request.COOKIES.get('access_token')
        device_token = request.COOKIES.get('trusted_device')
        
        if not raw_token:
            return None
            
        try:
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            
            # Remote Logout Check: Verify device_token if present
            # For enhanced security, we can require device_token for all cookie-based auth
            if device_token:
                from users.models import TrustedDevice
                if not TrustedDevice.objects.filter(user=user, device_token=device_token).exists():
                    raise AuthenticationFailed('Session has been revoked or expired')
            
            return user, validated_token
        except AuthenticationFailed as e:
            raise e
        except Exception:
            raise AuthenticationFailed('Invalid token in cookie')
