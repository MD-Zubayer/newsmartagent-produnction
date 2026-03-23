from django.urls import path
from .views import AgentSettingsDetailView, PublicSettingsView

urlpatterns = [
    path('agent-settings/', AgentSettingsDetailView.as_view(), name='agent-settings-detail'),
    path('public-settings/', PublicSettingsView.as_view(), name='public-settings'),
]
