
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from aiAgent.views import AgentAIViewSet, TokenUsageAnalyticsView, dashboard_chat_view, RankingAPIView, UserAvailableModelsView, AgentMetricsAPIView, DeleteRankingDataAPIView, UpdateCacheScopeAPIView, RequestSpecialAgentAPIView, ClearGlobalCacheAPIView, ToggleSharingAPIView, VisitorSubscribeView, VisitorTrackView
from aiAgent.contact_views import ContactListView, ToggleAutoReplyView, ContactMessageHistoryView, ContactDetailView, UnifiedReplyView
from aiAgent.widget_views import WidgetConfigView, WidgetChatView, WidgetIconUploadView
from chat.views import facebook_data_deletion_callback
router = DefaultRouter()
router.register(r'agents', AgentAIViewSet, basename='agent-ai')


urlpatterns = [
    path('', include(router.urls)),
    path("tokens/analytics/", TokenUsageAnalyticsView.as_view(), name="token_analytics"),
    path("dashboard-ai/", dashboard_chat_view, name='dashboard_ai'),
    path("ranking/<str:agent_id>/", RankingAPIView.as_view(), name='ranking-api'),
    path('ranking/delete/<str:agent_id>/<str:msg_hash>/', DeleteRankingDataAPIView.as_view(), name='delete-ranking'),
    path('ranking/clear-global-cache/', ClearGlobalCacheAPIView.as_view(), name='clear-global-cache'),
    path('ranking/update-scope/<str:agent_id>/<str:msg_hash>/', UpdateCacheScopeAPIView.as_view(), name='update-cache-scope'),
    path('ranking/toggle-sharing/<str:agent_id>/<str:msg_hash>/', ToggleSharingAPIView.as_view(), name='toggle-sharing'),
    path('ranking/request-special/<str:agent_id>/', RequestSpecialAgentAPIView.as_view(), name='request-special-agent'),
    path("metrics/<str:agent_id>/", AgentMetricsAPIView.as_view(), name='agent-metrics'),
    path("facebook/data-deletion/", facebook_data_deletion_callback, name="facebook_data_deletion_callback"),
    path('available-models/', UserAvailableModelsView.as_view(), name='user-available-models'),
    path('contacts/<str:agent_id>/', ContactListView.as_view(), name='contact-list'),
    path('contacts/detail/<int:contact_id>/', ContactDetailView.as_view(), name='contact-detail'),
    path('contacts/toggle-reply/<int:contact_id>/', ToggleAutoReplyView.as_view(), name='toggle-auto-reply'),
    path('contacts/<int:contact_id>/messages/', ContactMessageHistoryView.as_view(), name='contact-messages'),
    path('contacts/unified/reply/', UnifiedReplyView.as_view(), name='unified-reply'),
    
    # Web Widget Public API
    path('widget/config/<str:widget_key>/', WidgetConfigView.as_view(), name='widget-config'),
    path('widget/chat/<str:widget_key>/', WidgetChatView.as_view(), name='widget-chat'),
    # Widget Icon Upload (authenticated)
    path('widget/upload-icon/<int:agent_id>/', WidgetIconUploadView.as_view(), name='widget-icon-upload'),
    
    # Visitor Tracking (Public - No Auth Required)
    path('visitor/track/', VisitorTrackView.as_view(), name='visitor-track'),
    path('visitor/subscribe/', VisitorSubscribeView.as_view(), name='visitor-subscribe'),

]

