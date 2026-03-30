from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CommunityReport, CommunityReply
from .serializers import CommunityReportSerializer


class CommunityReportViewSet(viewsets.ModelViewSet):
  queryset = CommunityReport.objects.all().prefetch_related("replies")
  serializer_class = CommunityReportSerializer
  permission_classes = [permissions.AllowAny]
  lookup_field = "public_id"
  http_method_names = ["get", "post", "head", "options"]

  def perform_create(self, serializer):
    serializer.save()

  @action(
      detail=True,
      methods=["post"],
      permission_classes=[permissions.IsAdminUser],
      url_path="reply",
  )
  def reply(self, request, public_id=None):
    report = self.get_object()
    text = (request.data.get("text") or "").strip()
    if not text:
      return Response({"detail": "Reply text is required."}, status=status.HTTP_400_BAD_REQUEST)

    author = (
        getattr(request.user, "full_name", None)
        or getattr(request.user, "name", None)
        or getattr(request.user, "email", None)
        or "NSA Team"
    )
    CommunityReply.objects.create(report=report, author_name=author, text=text)
    if report.status == "Open":
      report.status = "In Review"
      report.save(update_fields=["status"])

    serializer = self.get_serializer(report)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
