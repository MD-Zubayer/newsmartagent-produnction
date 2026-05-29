from django.contrib import admin, messages
from django.utils import timezone
from unfold.admin import ModelAdmin
from unfold.decorators import action, display # <-- Use Unfold's display, not Django's

from .models import PathaoCourierConfig, PathaoBookingLog, PathaoCity, PathaoZone, PathaoArea
from .views import PathaoCourierClient 
from .tasks import sync_pathao_locations

@admin.register(PathaoCourierConfig)
class PathaoCourierConfigAdmin(ModelAdmin):
    list_display = (
        "user", 
        "display_status", 
        "is_sandbox", 
        "store_id", 
        "token_validity", 
    )
    
    readonly_fields = (
        "access_token",
        "refresh_token",
        "token_expires_at",
        "created_at",
        "updated_at",
    )

    # Note: Unfold's @display decorator supports 'label'
    @display(description="Status", label=True)
    def display_status(self, obj):
        if obj.is_active:
            return "Active", "success" # Text, Color
        return "Inactive", "danger"

    @display(description="Token Status", label=True)
    def token_validity(self, obj):
        if obj.access_token and obj.token_expires_at:
            if obj.token_expires_at > timezone.now():
                return "Valid", "success"
            return "Expired", "warning"
        return "No Token", "info"

    @action(description="Verify Connection & Refresh Token")
    def verify_pathao_connection(self, request, queryset):
        for config in queryset:
            try:
                client = PathaoCourierClient(config)
                client.get_access_token()
                self.message_user(request, f"Successfully verified {config.user.email}", messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f"Failed for {config.user.email}: {str(e)}", messages.ERROR)

    @action(description="Sync All Cities, Zones & Areas from Pathao")
    def trigger_pathao_sync(self, request, queryset):
        for config in queryset:
            if not config.is_active:
                self.message_user(request, f"Config for {config.user.email} is inactive. Skipping sync.", messages.WARNING)
                continue
            try:
                sync_pathao_locations.delay() # Run via Celery in background
                self.message_user(request, f"Sync started in background for {config.user.email}! This may take a few minutes.", messages.SUCCESS)
            except Exception as e:
                self.message_user(request, f"Failed to queue sync for {config.user.email}: {str(e)}", messages.ERROR)

    actions = [verify_pathao_connection, trigger_pathao_sync]

@admin.register(PathaoBookingLog)
class PathaoBookingLogAdmin(ModelAdmin):
    list_display = (
        "consignment_id", 
        "order_link", 
        "status_badge", 
        "created_at"
    )
    
    @display(description="Order")
    def order_link(self, obj):
        return f"Order #{obj.order.id}"

    @display(description="Pathao Status", label={
        "Order Created": "info",
        "In Transit": "warning",
        "Delivered": "success",
        "Cancelled": "danger",
    })
    def status_badge(self, obj):
        return obj.status

@admin.register(PathaoCity)
class PathaoCityAdmin(ModelAdmin):
    list_display = ("city_id", "city_name")
    search_fields = ("city_name", "city_id")

@admin.register(PathaoZone)
class PathaoZoneAdmin(ModelAdmin):
    list_display = ("zone_id", "zone_name", "city")
    search_fields = ("zone_name", "zone_id", "city__city_name")
    list_filter = ("city",)

@admin.register(PathaoArea)
class PathaoAreaAdmin(ModelAdmin):
    list_display = ("area_id", "area_name", "zone")
    search_fields = ("area_name", "area_id", "zone__zone_name")
    list_filter = ("zone__city",)