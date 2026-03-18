from django.db import models
from django.conf import settings
from django.utils import timezone
from django_cryptography.fields import encrypt



# Create your models here.
class AIProviderModel(models.Model):
    PROVIDER_CHOICES = [
        ('gemini', 'Google Gemini'),
        ('openai', 'OpenAI'),
        ('grok', 'xAI Grok'),
        ('openrouter', 'OpenRouter'),
    ]
    name = models.CharField(max_length=100, help_text="e.g. GPT-4o Mini, Gemini Pro")
    model_id = models.CharField(max_length=100, help_text="e.g. gpt-4o-mini, gemini-2.0-flash")
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.get_provider_display()} - {self.name}"

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
    selected_model = models.ForeignKey(
        AIProviderModel, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True
    )
    page_id = models.CharField(max_length=100, unique=True, db_index=True, blank=True)
    # Primary identifier for WhatsApp agents (phone number without country formatting assumptions)
    number = models.CharField(max_length=50, blank=True, null=True, db_index=True)

    access_token = encrypt(models.TextField())
    webhook_secret = models.CharField(max_length=255, blank=True)

    system_prompt = models.TextField()
    greeting_message = models.TextField(blank=True, null=True)

    custom_keywords = models.TextField(
        default="দাম, স্টক, ঠিকানা, price, info", 
        help_text="কমা দিয়ে কি-ওয়ার্ডগুলো লিখুন"
    )
    ai_model = models.CharField(max_length=50,default="gpt-4o-mini")
    memory_extraction_model = models.ForeignKey(
        AIProviderModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='agents_memory_extraction',
        help_text="এজেন্ট মেমোরি এক্সট্রাকশনের জন্য কোন মডেল ব্যবহার হবে? (শুধুমাত্র অ্যাডমিন)"
    )
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=200)

    token_expires_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    skip_history = models.BooleanField(default=False, help_text="AI call এ মেমোরি/হিস্টোরি ব্যবহার করবে কিনা?")
    history_skip_keywords = models.TextField(blank=True, null=True, help_text="কমা দিয়ে হিস্টোরি স্কিপ কি-ওয়ার্ডগুলো লিখুন")
    is_special_agent = models.BooleanField(default=False, help_text="বিশেষ এজেন্টদের ডাটা দীর্ঘক্ষণ (১ বছর) ক্যাশে থাকবে")

    SPECIAL_AGENT_STATUS_CHOICES = [
        ('none', 'None'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    special_agent_status = models.CharField(
        max_length=20, 
        choices=SPECIAL_AGENT_STATUS_CHOICES, 
        default='none',
        help_text="Status of the user's request for Special Agent features."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    

    def save(self, *args, **kwargs):
        # Sync legacy ai_model field with selected_model if present
        if self.selected_model:
            self.ai_model = self.selected_model.model_id
        
        # Auto-activate is_special_agent when approved
        if self.special_agent_status == 'approved':
            self.is_special_agent = True
            
        super().save(*args, **kwargs)

    def is_token_valid(self):
        if not self.token_expires_at:
            return True
        return self.token_expires_at > timezone.now()
    
    def __str__(self):
        return f'{self.name} ({self.user})'



class UserMemory(models.Model):
    ai_agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE)
    sender_id = models.CharField(max_length=255)
    data = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
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
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
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
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,related_name='dashboard_ai_logs')
    message_id = models.CharField(max_length=255, null=True, blank=True, db_index=True)
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


class SmartKeyword(models.Model):
    CATEGORY_CHOICES = [
        ('location', 'Location / Geography'),
        ('skip', 'Skip Keyword (Greetings/Filler)'),
        ('history_skip', 'History Skip (No History in AI)'),
        ('embedding_skip', 'Embedding Skip (No RAG Search)'),
        ('target', 'Target Keyword (High Priority)'),
        ('intent', 'User Intent (Order/Price)'),
        ('urgency', 'Urgency'),
        ('number', 'Numeric Keyword'),
    ]
    
    text = models.CharField(max_length=255, db_index=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.get_category_display()}] {self.text}"

    class Meta:
        verbose_name = "Smart Keyword"
        verbose_name_plural = "Smart Keywords"
        unique_together = ('text', 'category')
        indexes = [
            models.Index(fields=['category', 'text']),
        ]

class Contact(models.Model):
    PLATFORM_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('messenger', 'Messenger'),
    ]
    agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE, related_name='contacts')
    identifier = models.CharField(max_length=255, db_index=True)  # Phone number or Messenger Sender ID
    name = models.CharField(max_length=255, blank=True, null=True)
    push_name = models.CharField(max_length=255, blank=True, null=True)
    is_auto_reply_enabled = models.BooleanField(default=True)
    custom_prompt = models.TextField(blank=True, null=True, help_text="Custom system prompt for this specific contact")
    custom_instructions = models.TextField(blank=True, null=True, help_text="Additional instructions for this contact")
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('agent', 'identifier')
        verbose_name = "Contact"
        verbose_name_plural = "Contacts"

    def __str__(self):
        return f"{self.name or self.identifier} ({self.platform}) - Agent: {self.agent.id}"
