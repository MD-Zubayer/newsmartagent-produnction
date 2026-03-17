import logging

from django.contrib import admin, messages
from unfold.admin import ModelAdmin

from .models import WhatsAppInstance, WhatsAppMessage
from .services import stop_baileys_session_for_user

logger = logging.getLogger('openwa')


@admin.register(WhatsAppInstance)
class WhatsAppInstanceAdmin(ModelAdmin):
    list_display = ['user', 'phone_number', 'status', 'baileys_api_url', 'updated_at']
    list_filter = ['status']
    search_fields = ['user__email', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']

    def delete_model(self, request, obj):
        stop_baileys_session_for_user(obj.user_id)
        super().delete_model(request, obj)
        messages.info(request, "Baileys session stopped for the deleted instance.")

    def delete_queryset(self, request, queryset):
        for instance in queryset:
            stop_baileys_session_for_user(instance.user_id)
        super().delete_queryset(request, queryset)
        messages.info(request, "Baileys sessions cleaned up for selected instances.")


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(ModelAdmin):
    list_display = ['direction', 'from_phone', 'to_phone', 'message_text_short', 'timestamp']
    list_filter = ['direction', 'timestamp']
    search_fields = ['from_phone', 'to_phone', 'message_text']
    readonly_fields = ['timestamp']

    def message_text_short(self, obj):
        return obj.message_text[:60]
    message_text_short.short_description = 'Message'
