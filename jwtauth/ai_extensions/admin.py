from django.contrib import admin
from .models import Extension, ExtensionAssignment, ExtensionExecutionLog, ExtensionVersion


@admin.register(Extension)
class ExtensionAdmin(admin.ModelAdmin):
    list_display = ("name", "key", "category", "is_installed", "is_enabled", "dashboard_visible", "updated_at")
    list_filter = ("category", "is_installed", "is_enabled", "dashboard_visible")
    search_fields = ("name", "key", "description")
    list_editable = ("dashboard_visible",)

    def save_model(self, request, obj, form, change):
        """Treat global disable as a kill switch for every active assignment."""
        was_enabled = None
        if change and obj.pk:
            was_enabled = Extension.objects.filter(pk=obj.pk).values_list("is_enabled", flat=True).first()
        super().save_model(request, obj, form, change)
        if change and was_enabled and not obj.is_enabled:
            ExtensionAssignment.objects.filter(extension=obj, is_enabled=True).update(is_enabled=False)
            self.message_user(
                request,
                f"{obj.name}: all active assignments were disabled globally.",
                level="warning",
            )


@admin.register(ExtensionVersion)
class ExtensionVersionAdmin(admin.ModelAdmin):
    list_display = ("extension", "version", "target", "status", "compatible_base_version", "created_at")
    list_filter = ("status", "target", "extension")
    search_fields = ("extension__name", "extension__key", "version", "release_notes")


@admin.register(ExtensionAssignment)
class ExtensionAssignmentAdmin(admin.ModelAdmin):
    list_display = ("extension", "version", "scope", "agent", "user", "is_enabled", "priority")
    list_filter = ("scope", "is_enabled", "extension")
    search_fields = ("extension__name", "extension__key", "version__version")


@admin.register(ExtensionExecutionLog)
class ExtensionExecutionLogAdmin(admin.ModelAdmin):
    list_display = ("request_id", "extension", "version", "agent", "success", "latency_ms", "created_at")
    list_filter = ("success", "extension", "version")
    search_fields = ("request_id", "error_message")
    readonly_fields = [field.name for field in ExtensionExecutionLog._meta.fields]

