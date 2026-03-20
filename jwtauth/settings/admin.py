from .models import AgentSettings, GlobalSettings, AgentAISettings

@admin.register(AgentAISettings)
class AgentAISettingsAdmin(admin.ModelAdmin):
    list_display = ('agent', 'history_limit', 'temperature', 'max_tokens', 'skip_history')
    search_fields = ('agent__name', 'agent__page_id')

admin.site.register(AgentSettings)

@admin.register(GlobalSettings)
class GlobalSettingsAdmin(admin.ModelAdmin):
    # Only allow one instance to be edited
    def has_add_permission(self, request):
        if self.model.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False
