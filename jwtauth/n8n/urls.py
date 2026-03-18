from django.urls import path
from .views import N8NErrorAlertView

urlpatterns = [
    path('error-alert/', N8NErrorAlertView.as_view(), name='n8n-error-alert'),
]
