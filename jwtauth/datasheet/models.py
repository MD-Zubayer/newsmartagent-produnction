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
    tokens_count = models.IntegerField(default=0, help_text="Total tokens consumed by the spreadsheet data")
    colors = models.JSONField(default=dict, help_text="Stores cell colors as {'0-1': '#ffffff'}", blank=True, null=True)
    styles = models.JSONField(default=dict, help_text="Stores cell styles as {'0-1': {'fontWeight': 'bold'}}", blank=True, null=True)

    is_dark_mode = models.BooleanField(default=False)
    zoom_level = models.PositiveIntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if getattr(self, 'data', None):
            try:
                import tiktoken
                encoding = tiktoken.get_encoding('cl100k_base')
                
                # Combine all text from all cells
                text_content = ""
                if isinstance(self.data, dict):
                    for val in self.data.values():
                        if val is not None:
                            text_content += str(val) + " "
                elif isinstance(self.data, str):
                    text_content = self.data

                # Some approximation if tiktoken throws issue or exact length
                if text_content.strip():
                    self.tokens_count = len(encoding.encode(text_content))
                else:
                    self.tokens_count = 0
            except Exception:
                # Fallback approximation
                text_len = len(str(self.data)) if self.data else 0
                self.tokens_count = text_len // 4
        else:
            self.tokens_count = 0
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.title} - {self.user.email}'
        
    class Meta:
        ordering = ['-updated_at']
