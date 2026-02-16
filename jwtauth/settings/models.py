from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

# Create your models here.

class AgentSettings(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='agent_settings')
    is_order_enable = models.BooleanField(default=True)
    
    def __str__(self):
        return f"Settings for {self.user.name}"