from django.db import models
from django.conf import settings
from django.utils import timezone
from django_cryptography.fields import encrypt
from django.contrib.auth import get_user_model

User = get_user_model()


# Create your models here.


class AgentAI(models.Model):

    PLATFORM_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('messenger', 'Messenger'),
        ('facebook_comment', 'Facebook Comment')
    ]
    AI_AGENT_CATEGORIES = (
    ('business', 'Business / Commercial'),
    ('support', 'Customer Support & Service'),
    ('creator', 'Content Creator / Social Media'),
    ('personal', 'Personal Life & Productivity'),
    ('education', 'Education & Training'),
    ('other', 'Other / Custom'),
)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='agentsAi')

    name = models.CharField(max_length=120, null=True, blank=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    ai_agent_type = models.CharField(max_length=20, choices=AI_AGENT_CATEGORIES, default='business', help_text="এই AI এজেন্টটি মূলত কোন কাজের জন্য ব্যবহার করা হবে?")

    page_id = models.CharField(max_length=100, unique=True, db_index=True, blank=True)

    access_token = encrypt(models.TextField())
    webhook_secret = models.CharField(max_length=255, blank=True)

    system_prompt = models.TextField()
    greeting_message = models.TextField(blank=True, null=True)

    custom_keywords = models.TextField(
        default="দাম, স্টক, ঠিকানা, price, info", 
        help_text="কমা দিয়ে কি-ওয়ার্ডগুলো লিখুন"
    )
    ai_model = models.CharField(max_length=50,default="gpt-4o-mini")
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=200)

    token_expires_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    

    def is_token_valid(self):
        if not self.token_expires_at:
            return True
        return self.token_expires_at > timezone.now()
    
    def __str__(self):
        return f'{self.name} ({self.user})'



class UserMemory(models.Model):
    ai_agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE)
    sender_id = models.CharField(max_length=255)
    data = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('ai_agent', 'sender_id')

class MissingRequirement(models.Model):
    ai_agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE)
    sender_id = models.CharField(max_length=255)
    question = models.TextField()
    checked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.question[:30]} - {self.sender_id}"



class TokenUsageLog(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='token_usages'
    )
    ai_agent = models.ForeignKey(
        "AgentAI",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='usage_logs'
    
    )

    sender_id = models.CharField(max_length=255, db_index=True)
    platform = models.CharField(max_length=50, default='messenger')
    model_name = models.CharField(max_length=100, db_index=True)


    input_tokens = models.PositiveIntegerField(default=0)
    output_tokens = models.PositiveIntegerField(default=0)
    total_tokens = models.PositiveIntegerField(default=0)

    request_type = models.CharField(max_length=50, default='chat')
    success = models.BooleanField(default=True, db_index=True)
    error_message = models.TextField(blank=True, null=True)
    response_time = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['created_at', 'platform']),
            models.Index(fields=['ai_agent', 'created_at']),
        ]
        ordering = ['-created_at']
        verbose_name = 'Token Usage Log'

    def __str__(self):
        return f"{self.platform} | {self.total_tokens} tokens | {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class DashboardAILog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE,related_name='dashboard_ai_logs')
    pathname = models.CharField(max_length=255)
    question = models.TextField()
    answer = models.TextField()

    # টোকেন ট্র্যাকিং (ভবিষ্যতে খরচের হিসেব রাখতে)
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.pathname} - {self.created_at}"