from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# Create your models here.

class AgentSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_settings')
    is_order_enable = models.BooleanField(default=True)
    
    # Auto Renew Settings
    auto_renew_enabled = models.BooleanField(default=False)
    auto_renew_offer = models.ForeignKey('users.Offer', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Settings for {self.user.name}"


class GlobalSettings(models.Model):
    """
    Singleton model to hold system-wide settings that apply globally,
    such as the default AI model for the Dashboard Assistant.
    """
    dashboard_ai_model = models.ForeignKey(
        'aiAgent.AIProviderModel', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        help_text="Select the AI model that will be used globally for the Dashboard Assistant (New Smart Agent)."
    )
    
    class Meta:
        verbose_name = "Global Setting"
        verbose_name_plural = "Global Settings"

    def save(self, *args, **kwargs):
        # Ensure only one instance exists.
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "System Global Settings"