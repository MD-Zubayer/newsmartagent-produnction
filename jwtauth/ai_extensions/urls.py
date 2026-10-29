from rest_framework.routers import DefaultRouter
from .views import ExtensionAssignmentViewSet, ExtensionExecutionLogViewSet, ExtensionVersionViewSet, ExtensionViewSet

router = DefaultRouter()
router.register("extensions", ExtensionViewSet, basename="ai-extension")
router.register("versions", ExtensionVersionViewSet, basename="ai-extension-version")
router.register("assignments", ExtensionAssignmentViewSet, basename="ai-extension-assignment")
router.register("executions", ExtensionExecutionLogViewSet, basename="ai-extension-execution")
urlpatterns = router.urls
