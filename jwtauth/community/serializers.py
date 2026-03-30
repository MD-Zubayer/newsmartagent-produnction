from rest_framework import serializers
from .models import CommunityReport, CommunityReply, ReportComment


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

  class Meta:
    model = ReportComment
    fields = ("id", "by", "at", "text")

  def get_at(self, obj):
    return obj.created_at.strftime("%d %b %Y, %I:%M %p")


class CommunityReportSerializer(serializers.ModelSerializer):
  id = serializers.CharField(source="public_id", read_only=True)
  submittedBy = serializers.CharField(source="name", allow_blank=True, required=False)
  submittedAt = serializers.SerializerMethodField()
  replies = CommunityReplySerializer(many=True, read_only=True)
  comments = ReportCommentSerializer(many=True, read_only=True)
  like_count = serializers.IntegerField(read_only=True)
  comment_count = serializers.IntegerField(read_only=True)

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
        "replies",
        "comments",
        "like_count",
        "comment_count",
    )

  def get_submittedAt(self, obj):
    return obj.created_at.strftime("%d %b %Y")
