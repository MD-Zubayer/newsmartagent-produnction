import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model
from channels.db import database_sync_to_async

User = get_user_model()

@database_sync_to_async
def get_user_from_jwt(token):
    try:
        # টোকেন ডিকোড করা
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("user_id")
        return User.objects.get(id=user_id)
    except Exception as e:
        print(f"JWT Decode Error: {e}")
        return AnonymousUser()

class CookieTokenAuthMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        headers = dict(scope.get("headers", []))
        cookie_header = headers.get(b"cookie", b"").decode()
        
        token = None
        if cookie_header:
            # কুকি থেকে access_token খুঁজে বের করা
            for cookie in cookie_header.split("; "):
                if cookie.strip().startswith("access_token="):
                    token = cookie.split("=")[1]

        if token:
            scope['user'] = await get_user_from_jwt(token)
        else:
            scope['user'] = AnonymousUser()

        print(f"✅ WebSocket Attempt: User {scope['user']}")
        return await self.app(scope, receive, send)