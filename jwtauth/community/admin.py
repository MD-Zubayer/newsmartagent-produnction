from django.contrib import admin
from .models import CommunityReport, CommunityReply


class CommunityReplyInline(admin.TabularInline):
  model = CommunityReply
  extra = 0
  readonly_fields = ("author_name", "text", "created_at")
  can_delete = False


@admin.register(CommunityReport)
class CommunityReportAdmin(admin.ModelAdmin):
  list_display = ("public_id", "title", "category", "status", "created_at")
  list_filter = ("category", "status", "created_at")
  search_fields = ("public_id", "title", "details", "name", "email")
  ordering = ("-created_at",)
  readonly_fields = ("public_id", "created_at", "updated_at")
  inlines = [CommunityReplyInline]


@admin.register(CommunityReply)
class CommunityReplyAdmin(admin.ModelAdmin):
  list_display = ("report", "author_name", "created_at")
  search_fields = ("report__public_id", "author_name", "text")
  ordering = ("-created_at",)
