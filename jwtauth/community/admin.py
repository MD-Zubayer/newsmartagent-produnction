from django.contrib import admin
from .models import CommunityReport, CommunityReply, ReportLike, ReportComment


class CommunityReplyInline(admin.TabularInline):
  model = CommunityReply
  extra = 1
  readonly_fields = ("author_name", "created_at")
  can_delete = True


class ReportCommentInline(admin.TabularInline):
  model = ReportComment
  extra = 0
  readonly_fields = ("author_name", "text", "created_at")
  can_delete = True


class ReportLikeInline(admin.TabularInline):
  model = ReportLike
  extra = 0
  readonly_fields = ("ip_address", "created_at")
  can_delete = True


@admin.register(CommunityReport)
class CommunityReportAdmin(admin.ModelAdmin):
  list_display = ("public_id", "title", "category", "status", "name", "email", "like_count", "comment_count", "created_at")
  list_editable = ("category", "status")
  list_filter = ("category", "status", "created_at")
  search_fields = ("public_id", "title", "details", "name", "email")
  ordering = ("-created_at",)
  readonly_fields = ("public_id", "created_at", "updated_at", "like_count", "comment_count")
  inlines = [CommunityReplyInline, ReportCommentInline, ReportLikeInline]

  class Media:
      js = ('community/js/admin_status_filter.js',)


@admin.register(CommunityReply)
class CommunityReplyAdmin(admin.ModelAdmin):
  list_display = ("report", "author_name", "created_at")
  search_fields = ("report__public_id", "author_name", "text")
  ordering = ("-created_at",)


@admin.register(ReportComment)
class ReportCommentAdmin(admin.ModelAdmin):
  list_display = ("report", "author_name", "author_email", "text", "created_at")
  search_fields = ("report__public_id", "author_name", "text")
  ordering = ("-created_at",)


@admin.register(ReportLike)
class ReportLikeAdmin(admin.ModelAdmin):
  list_display = ("report", "ip_address", "created_at")
  search_fields = ("report__public_id", "ip_address")
  ordering = ("-created_at",)
