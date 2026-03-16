from django.contrib import admin
from .models import AgentSettings, GlobalSettings

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
