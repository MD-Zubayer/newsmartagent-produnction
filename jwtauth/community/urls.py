from rest_framework.routers import DefaultRouter
from .views import CommunityReportViewSet

router = DefaultRouter()
router.register(r'community', CommunityReportViewSet, basename='community')

urlpatterns = router.urls
