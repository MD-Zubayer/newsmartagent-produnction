from django.urls import path
from . import views

urlpatterns = [
    path('init/', views.whatsapp_init_session, name='whatsapp-init'),
    path('status/', views.WhatsAppStatusView.as_view(), name='whatsapp-status'),
    path('qr/', views.WhatsAppQRView.as_view(), name='whatsapp-qr'),
    path('pairing-code/', views.WhatsAppPairingCodeView.as_view(), name='whatsapp-pairing-code'),
    path('pairing-code', views.WhatsAppPairingCodeView.as_view()),
    path('send/', views.WhatsAppSendView.as_view(), name='whatsapp-send'),
    path('sync-agent/', views.whatsapp_sync_agent, name='whatsapp-sync-agent'),
    path('sync-contacts/', views.whatsapp_sync_contacts, name='whatsapp-sync-contacts'),
]
