from django.urls import path
from .views import AgentSettingsDetailView, PublicSettingsView, TelegramBotSetupView, TelegramSharedBotView

urlpatterns = [
    path('agent-settings/', AgentSettingsDetailView.as_view(), name='agent-settings-detail'),
    path('public-settings/', PublicSettingsView.as_view(), name='public-settings'),
    path('telegram/setup/', TelegramBotSetupView.as_view(), name='telegram-bot-setup'),
    path('telegram/shared-bot/', TelegramSharedBotView.as_view(), name='telegram-shared-bot'),
]
