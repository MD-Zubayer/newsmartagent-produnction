from django.urls import path
from payments.views import ManualPaymentCreateView



urlpatterns = [
    path('manual-payments/', ManualPaymentCreateView.as_view(), name='payment_manual'),
]
