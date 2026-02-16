from django.urls import path, include
from rest_framework.routers import DefaultRouter
from aiAgent.views import AgentAIViewSet, TokenUsageAnalyticsView


router = DefaultRouter()
router.register(r'agents', AgentAIViewSet, basename='agent-ai')


urlpatterns = [
    path('', include(router.urls)),
    path("tokens/analytics/", TokenUsageAnalyticsView.as_view(), name="token_analytics")

]
