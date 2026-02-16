from django.db import models
from django.conf import settings


# Create your models here.


class ManAgentConfig(models.Model):
    man_agent = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='man_agent_config')
    otp_key = models.CharField(max_length=50, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


    def __str__(self):
        return f"{self.man_agent.email} | Key: {self.otp_key}"

class ReferralRelation(models.Model):
    man_agent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='my_referrals')
    referred_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='referred_by')
    used_otp_key = models.CharField(max_length=50)
    joined_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Agent: {self.man_agent.name} -> User: {self.referred_user.email}"
