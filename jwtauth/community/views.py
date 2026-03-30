from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CommunityReport, CommunityReply, ReportLike, ReportComment
from .serializers import CommunityReportSerializer, ReportCommentSerializer


def get_client_ip(request):
  """Real IP extract করে (proxy এর পিছনেও কাজ করে)।"""
  x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
  if x_forwarded:
    return x_forwarded.split(",")[0].strip()
  return request.META.get("REMOTE_ADDR", "0.0.0.0")


class CommunityReportViewSet(viewsets.ModelViewSet):
  queryset = CommunityReport.objects.all().prefetch_related("replies", "comments", "likes")
  serializer_class = CommunityReportSerializer
  permission_classes = [permissions.AllowAny]
  lookup_field = "public_id"
  http_method_names = ["get", "post", "head", "options"]

  def perform_create(self, serializer):
    serializer.save()

  def list(self, request, *args, **kwargs):
    """Reports list — category, status filter এবং search সহ।"""
    qs = self.get_queryset()

    category = request.query_params.get("category")
    report_status = request.query_params.get("status")
    search = request.query_params.get("search", "").strip()

    if category and category != "All":
      qs = qs.filter(category=category)
    if report_status and report_status != "All":
      qs = qs.filter(status=report_status)
    if search:
      qs = qs.filter(title__icontains=search)

    serializer = self.get_serializer(qs, many=True, context={'request': request})
    reports = serializer.data

    # Summary stats filtered by current category
    stats_qs = CommunityReport.objects.all()
    if category and category != "All":
      stats_qs = stats_qs.filter(category=category)

    total = stats_qs.count()
    open_count = stats_qs.filter(status="Open").count()
    resolved_count = stats_qs.filter(status="Resolved").count()
    in_review_count = stats_qs.filter(status="In Review").count()

    # Optional: Average rating for Review category
    avg_rating = 0
    if category == "Review" and total > 0:
      from django.db.models import Avg
      avg_rating = stats_qs.aggregate(Avg("rating"))["rating__avg"] or 0
      avg_rating = round(avg_rating, 1)

    return Response({
      "reports": reports,
      "stats": {
        "total": total,
        "open": open_count,
        "resolved": resolved_count,
        "in_review": in_review_count,
        "avg_rating": avg_rating,
      }
    })

  # ─── Admin Reply ─────────────────────────────────────────────
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

  # ─── Like Toggle ─────────────────────────────────────────────
  @action(
      detail=True,
      methods=["post"],
      permission_classes=[permissions.AllowAny],
      url_path="like",
  )
  def like(self, request, public_id=None):
    report = self.get_object()
    ip = get_client_ip(request)

    like_obj, created = ReportLike.objects.get_or_create(report=report, ip_address=ip)
    if not created:
      # ইতিমধ্যে like দেওয়া আছে — unlike করো
      like_obj.delete()
      liked = False
    else:
      liked = True

    return Response({
      "liked": liked,
      "like_count": report.likes.count(),
    }, status=status.HTTP_200_OK)

  # ─── Comment Submit ───────────────────────────────────────────
  @action(
      detail=True,
      methods=["post"],
      permission_classes=[permissions.AllowAny],
      url_path="comment",
  )
  def comment(self, request, public_id=None):
    report = self.get_object()
    text = (request.data.get("text") or "").strip()
    author = (request.data.get("name") or "Anonymous").strip()

    if not text:
      return Response({"detail": "Comment text is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(text) > 1000:
      return Response({"detail": "Comment too long (max 1000 chars)."}, status=status.HTTP_400_BAD_REQUEST)

    comment_obj = ReportComment.objects.create(
      report=report,
      author_name=author or "Anonymous",
      author_email=request.data.get("email"),
      text=text,
    )
    serializer = ReportCommentSerializer(comment_obj)
    return Response(serializer.data, status=status.HTTP_201_CREATED)

  # ─── Guest Lookup (Cross-device recognition) ───────────
  @action(
      detail=False,
      methods=["get"],
      permission_classes=[permissions.AllowAny],
      url_path="lookup",
  )
  def lookup(self, request):
    email = request.query_params.get("email", "").strip().lower()
    if not email:
      return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

    # Search for the latest name used with this email in Reports or Comments
    name = None
    latest_report = CommunityReport.objects.filter(email__iexact=email).order_by("-created_at").first()
    if latest_report:
      name = latest_report.name

    latest_comment = ReportComment.objects.filter(author_email__iexact=email).order_by("-created_at").first()
    if latest_comment:
      # If comment is newer than report, use that name
      if not latest_report or latest_comment.created_at > latest_report.created_at:
        name = latest_comment.author_name

    if name:
      return Response({"name": name, "recognized": True})
    
    return Response({"recognized": False}, status=status.HTTP_404_NOT_FOUND)
