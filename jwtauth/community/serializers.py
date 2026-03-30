from rest_framework import serializers
from .models import CommunityReport, CommunityReply


class CommunityReplySerializer(serializers.ModelSerializer):
  by = serializers.CharField(source="author_name", read_only=True)
  at = serializers.SerializerMethodField()

  class Meta:
    model = CommunityReply
    fields = ("by", "at", "text")

  def get_at(self, obj):
    return obj.created_at.date().isoformat()


class CommunityReportSerializer(serializers.ModelSerializer):
  id = serializers.CharField(source="public_id", read_only=True)
  submittedBy = serializers.CharField(source="name", allow_blank=True, required=False)
  submittedAt = serializers.SerializerMethodField()
  replies = CommunityReplySerializer(many=True, read_only=True)

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
    )

  def get_submittedAt(self, obj):
    return obj.created_at.date().isoformat()
