from rest_framework import serializers
from .models import CommunityReport, CommunityReply, ReportComment, ReportLike


class CommunityReplySerializer(serializers.ModelSerializer):
  by = serializers.CharField(source="author_name", read_only=True)
  at = serializers.SerializerMethodField()

  class Meta:
    model = CommunityReply
    fields = ("by", "at", "text")

  def get_at(self, obj):
    return obj.created_at.strftime("%d %b %Y, %I:%M %p")


class ReportCommentSerializer(serializers.ModelSerializer):
  by = serializers.CharField(source="author_name", read_only=True)
  at = serializers.SerializerMethodField()
  is_verified = serializers.SerializerMethodField()

  class Meta:
    model = ReportComment
    fields = ("id", "by", "at", "text", "is_verified")

  def get_at(self, obj):
    return obj.created_at.strftime("%d %b %Y, %I:%M %p")

  def get_is_verified(self, obj):
    return bool(obj.author_email)


class CommunityReportSerializer(serializers.ModelSerializer):
  id = serializers.CharField(source="public_id", read_only=True)
  submittedBy = serializers.CharField(source="name", allow_blank=True, required=False)
  submittedAt = serializers.SerializerMethodField()
  replies = CommunityReplySerializer(many=True, read_only=True)
  comments = ReportCommentSerializer(many=True, read_only=True)
  like_count = serializers.IntegerField(read_only=True)
  comment_count = serializers.IntegerField(read_only=True)
  is_liked = serializers.SerializerMethodField()
  is_verified = serializers.SerializerMethodField()

  class Meta:
    model = CommunityReport
    fields = (
        "id",
        "category",
        "title",
        "details",
        "status",
        "submittedBy",
        "submittedAt",
        "email",
        "rating",
        "replies",
        "comments",
        "like_count",
        "comment_count",
        "is_liked",
        "is_verified",
    )

  def get_submittedAt(self, obj):
    return obj.created_at.strftime("%d %b %Y")

  def get_is_verified(self, obj):
    return bool(obj.email)

  def get_is_liked(self, obj):
    request = self.context.get("request")
    if not request:
      return False
    
    # Extract IP
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
      ip = x_forwarded.split(",")[0].strip()
    else:
      ip = request.META.get("REMOTE_ADDR")
    
    if not ip:
      return False
      
    return obj.likes.filter(ip_address=ip).exists()
