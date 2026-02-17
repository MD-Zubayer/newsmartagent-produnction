import os
import django
from django.core.asgi import get_asgi_application

# ১. আগে এনভায়রনমেন্ট সেট করুন
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jwtauth.settings')

# ২. জ্যাঙ্গো সেটআপ কল করুন (এটিই মেইন সমাধান)
django.setup()

# ৩. জ্যাঙ্গো সেটআপের পরে বাকিগুলো ইম্পোর্ট করুন
from channels.routing import ProtocolTypeRouter, URLRouter
from chat.middleware import CookieTokenAuthMiddleware 
import chat.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": CookieTokenAuthMiddleware(
        URLRouter(
            chat.routing.websocket_urlpatterns
        )
    ),
})