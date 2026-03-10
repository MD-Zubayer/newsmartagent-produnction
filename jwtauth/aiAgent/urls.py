from django.urls import path, include
from rest_framework.routers import DefaultRouter
from aiAgent.views import AgentAIViewSet, TokenUsageAnalyticsView, dashboard_chat_view, RankingAPIView, UserAvailableModelsView
from chat.views import facebook_data_deletion_callback
router = DefaultRouter()
router.register(r'agents', AgentAIViewSet, basename='agent-ai')


urlpatterns = [
    path('', include(router.urls)),
    path("tokens/analytics/", TokenUsageAnalyticsView.as_view(), name="token_analytics"),
    path("dashboard-ai/", dashboard_chat_view, name='dashboard_ai'),
    path("ranking/<str:agent_id>/", RankingAPIView.as_view(), name='ranking-api'),
    path("facebook/data-deletion/", facebook_data_deletion_callback, name="facebook_data_deletion_callback"),
    path('available-models/', UserAvailableModelsView.as_view(), name='user-available-models'),
    


]
