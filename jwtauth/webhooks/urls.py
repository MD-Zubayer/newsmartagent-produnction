from django.urls import path
from webhooks.views import test_webhook, ai_webhook, instagram_webhook, telegram_webhook

urlpatterns = [
    path('test/', test_webhook, name='test_webhooks'),
    path('ai/', ai_webhook, name='ai_webhook' ),
    path('instagram/', instagram_webhook, name='instagram_webhook' ),
    path('telegram/', telegram_webhook, name='telegram_webhook' ),
    
]
