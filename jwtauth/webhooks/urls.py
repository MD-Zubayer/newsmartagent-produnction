from django.urls import path
from webhooks.views import test_webhook, ai_webhook, instagram_webhook, telegram_webhook
from courier.views import SteadFastWebhookView

urlpatterns = [
    path('test/', test_webhook, name='test_webhooks'),
    path('ai/', ai_webhook, name='ai_webhook' ),
    path('instagram/', instagram_webhook, name='instagram_webhook' ),
    path('telegram/', telegram_webhook, name='telegram_webhook' ),
    path('steadfast/', SteadFastWebhookView.as_view(), name='webhook-steadfast'),
    path('steadfast', SteadFastWebhookView.as_view(), name='webhook-steadfast-noslash'),
    path('steadfast/<str:merchant_identifier>/', SteadFastWebhookView.as_view(), name='webhook-steadfast-merchant'),
    path('steadfast/<str:merchant_identifier>', SteadFastWebhookView.as_view(), name='webhook-steadfast-merchant-noslash'),
]
