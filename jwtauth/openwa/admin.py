from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import WhatsAppInstance, WhatsAppMessage


@admin.register(WhatsAppInstance)
class WhatsAppInstanceAdmin(ModelAdmin):
    list_display = ['user', 'phone_number', 'status', 'baileys_api_url', 'updated_at']
    list_filter = ['status']
    search_fields = ['user__email', 'phone_number']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(WhatsAppMessage)
class WhatsAppMessageAdmin(ModelAdmin):
    list_display = ['direction', 'from_phone', 'to_phone', 'message_text_short', 'timestamp']
    list_filter = ['direction', 'timestamp']
    search_fields = ['from_phone', 'to_phone', 'message_text']
    readonly_fields = ['timestamp']

    def message_text_short(self, obj):
        return obj.message_text[:60]
    message_text_short.short_description = 'Message'
