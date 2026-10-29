from django.urls import path
from payments.views import ManualPaymentCreateView, AutomaticPaymentVerifyView



urlpatterns = [
    path('manual-payments/', ManualPaymentCreateView.as_view(), name='payment_manual'),
    path('automatic-verify/', AutomaticPaymentVerifyView.as_view(), name='payment_automatic'),
]
