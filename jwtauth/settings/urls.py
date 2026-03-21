from django.urls import path
from .views import AgentSettingsDetailView

urlpatterns = [
    path('agent-settings/', AgentSettingsDetailView.as_view(), name='agent-settings-detail'),
]
