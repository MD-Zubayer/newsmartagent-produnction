from django.urls import path
from .views import WhatsAppSendView, WhatsAppStatusView, WhatsAppQRView

urlpatterns = [
    # n8n এই endpoint call করবে AI reply পাঠাতে
    path('whatsapp/send/', WhatsAppSendView.as_view(), name='whatsapp-send'),
    # Connection status check
    path('whatsapp/status/', WhatsAppStatusView.as_view(), name='whatsapp-status'),
    # QR code retrieve (প্রথমবার connect করতে)
    path('whatsapp/qr/', WhatsAppQRView.as_view(), name='whatsapp-qr'),
]
