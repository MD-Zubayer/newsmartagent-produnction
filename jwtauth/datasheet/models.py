from django.db import models
from django.conf import settings
# Create your models here.


class Spreadsheet(models.Model):

    title = models.CharField(max_length=255, default='Untiteled Sheet')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='spreadsheets')

    rows = models.PositiveIntegerField(default=20)
    cols = models.PositiveIntegerField(default=20)
    
    # 🔥 নতুুন যুক্ত করা হয়েছে (Scope Control)
    KNOWLEDGE_SCOPE = [
        ('global', 'Global (All Agents)'),
        ('agent_specific', 'Agent Specific'),
    ]
    scope = models.CharField(max_length=20, choices=KNOWLEDGE_SCOPE, default='global')
    agent = models.ForeignKey('aiAgent.AgentAI', on_delete=models.SET_NULL, null=True, blank=True, related_name='spreadsheets')

    data = models.JSONField(default=dict,help_text="Stores cell values as {'0-1': 'Hello'}", blank=True, null=True)
    colors = models.JSONField(default=dict, help_text="Stores cell colors as {'0-1': '#ffffff'}", blank=True, null=True)
    styles = models.JSONField(default=dict, help_text="Stores cell styles as {'0-1': {'fontWeight': 'bold'}}", blank=True, null=True)

    is_dark_mode = models.BooleanField(default=False)
    zoom_level = models.PositiveIntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.title} - {self.user.email}'
        
    class Meta:
        ordering = ['-updated_at']
