from django.urls import path
from .views import AgentSettingsDetailView, PublicSettingsView, TelegramBotSetupView, TelegramSharedBotView
from .comment_views import (
    CommentAutomationListView, CommentAutomationDetailView,
    CommentActivityLogView, PostContextNoteView,
)

urlpatterns = [
    path('comment-automation/', CommentAutomationListView.as_view(), name='comment-automation-list'),
    path('comment-automation/logs/', CommentActivityLogView.as_view(), name='comment-automation-logs'),
    path('comment-automation/post-notes/', PostContextNoteView.as_view(), name='comment-automation-post-notes'),
    path('comment-automation/<int:agent_id>/', CommentAutomationDetailView.as_view(), name='comment-automation-detail'),
    path('agent-settings/', AgentSettingsDetailView.as_view(), name='agent-settings-detail'),
    path('public-settings/', PublicSettingsView.as_view(), name='public-settings'),
    path('telegram/setup/', TelegramBotSetupView.as_view(), name='telegram-bot-setup'),
    path('telegram/shared-bot/', TelegramSharedBotView.as_view(), name='telegram-shared-bot'),
]
