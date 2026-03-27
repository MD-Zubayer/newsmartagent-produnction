from django.db import models
from django.conf import settings
from django.utils import timezone
from django.core.cache import cache
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
        ('facebook_comment', 'Facebook Comment'),
        ('instagram', 'Instagram'),
        ('web_widget', 'Web Chat Widget'),
        ('telegram', 'Telegram'),
        ('youtube', 'YouTube')
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
    page_id = models.CharField(max_length=100, unique=True, db_index=True, blank=True, null=True)
    # Primary identifier for WhatsApp agents (phone number without country formatting assumptions)
    number = models.CharField(max_length=50, blank=True, null=True, db_index=True)

    access_token = encrypt(models.TextField(blank=True, null=True))
    webhook_secret = models.CharField(max_length=255, blank=True)
    widget_key = models.CharField(max_length=100, unique=True, blank=True, null=True, db_index=True)

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
    token_expires_at = models.DateTimeField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
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

    @property
    def get_settings(self):
        from settings.models import AgentAISettings
        settings, created = AgentAISettings.objects.get_or_create(agent=self)
        return settings



class UserMemory(models.Model):
    ai_agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE)
    sender_id = models.CharField(max_length=255)
    data = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('ai_agent', 'sender_id')

class TelegramBotMapping(models.Model):
    """Mapping between Telegram chat IDs and AgentAI for shared bot"""
    chat_id = models.CharField(max_length=100, unique=True, db_index=True)
    agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telegram Bot Mapping"
        verbose_name_plural = "Telegram Bot Mappings"
        unique_together = ('chat_id', 'agent')

    def __str__(self):
        return f"Chat {self.chat_id} -> Agent {self.agent.name}"

class TelegramBot(models.Model):
    """Dedicated model for Telegram bot settings"""
    agent = models.OneToOneField(AgentAI, on_delete=models.CASCADE, related_name='telegram_bot_details')
    bot_token = encrypt(models.TextField(help_text="Bot API Token from BotFather"))
    bot_username = models.CharField(max_length=100, unique=True, db_index=True)
    bot_name = models.CharField(max_length=150, blank=True, null=True)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Telegram Bot"
        verbose_name_plural = "Telegram Bots"

    def __str__(self):
        return f"@{self.bot_username} ({self.agent.name})"

import uuid
from django.conf import settings
User = settings.AUTH_USER_MODEL

class ApiConfig(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    gemini_api_key = models.CharField(max_length=255, blank=True, null=True)
    openai_api_key = models.CharField(max_length=255, blank=True, null=True)
    
    def __str__(self):
        return f"{self.user.email} - API Config"

class WebsiteVisitor(models.Model):
    visitor_uuid = models.UUIDField(unique=True, editable=False, default=uuid.uuid4)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=512, null=True, blank=True)
    device_type = models.CharField(max_length=50, null=True, blank=True)
    location = models.CharField(max_length=255, null=True, blank=True)
    
    first_visited = models.DateTimeField(auto_now_add=True)
    last_visited = models.DateTimeField(auto_now=True)
    view_count = models.IntegerField(default=1)
    
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name='visitors')
    captured_email = models.EmailField(null=True, blank=True)
    captured_phone = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = "Website Visitor"
        verbose_name_plural = "Website Visitors"
        
    def __str__(self):
        return f"Visitor {self.visitor_uuid} (V: {self.view_count})"

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

class SmartTranslationMap(models.Model):
    source_text = models.CharField(max_length=255, unique=True, db_index=True)
    target_text = models.CharField(max_length=255, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Smart Translation Map"
        verbose_name_plural = "Smart Translation Maps"
        ordering = ['source_text']

    def save(self, *args, **kwargs):
        self.source_text = (self.source_text or "").strip()
        self.target_text = (self.target_text or "").strip()
        super().save(*args, **kwargs)
        cache.delete("smart_translation_map_v1")

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
        cache.delete("smart_translation_map_v1")

    def __str__(self):
        return f"{self.source_text} -> {self.target_text}"

class Contact(models.Model):
    PLATFORM_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('messenger', 'Messenger'),
        ('web_widget', 'Web Chat Widget'),
        ('facebook_comment', 'Facebook Comment'),
    ]
    agent = models.ForeignKey(AgentAI, on_delete=models.CASCADE, related_name='contacts')
    identifier = models.CharField(max_length=255, db_index=True)  # Phone number or Messenger Sender ID
    name = models.CharField(max_length=255, blank=True, null=True)
    push_name = models.CharField(max_length=255, blank=True, null=True)
    is_auto_reply_enabled = models.BooleanField(default=True)
    custom_prompt = models.TextField(blank=True, null=True, help_text="Custom system prompt for this specific contact")
    custom_instructions = models.TextField(blank=True, null=True, help_text="Additional instructions for this contact")
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    is_human_needed = models.BooleanField(default=False, help_text="Set to True if the user needs human assistance.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('agent', 'identifier')
        verbose_name = "Contact"
        verbose_name_plural = "Contacts"

    def __str__(self):
        return f"{self.name or self.identifier} ({self.platform}) - Agent: {self.agent.id}"


class WidgetSettings(models.Model):
    agent = models.OneToOneField(AgentAI, on_delete=models.CASCADE, related_name='widget_settings')
    
    # Appearance
    primary_color = models.CharField(max_length=7, default='#4f46e5')
    bubble_icon = models.CharField(max_length=50, default='image')  # 'image' or 'chat'
    bubble_icon_url = models.CharField(
        max_length=500,
        blank=True,
        default='',
        help_text="Custom bubble icon URL. Leave blank to use the default newsmartagent logo."
    )
    bubble_size = models.IntegerField(
        default=60,
        help_text="Bubble size in pixels (e.g. 52, 60, 72)."
    )
    bubble_roundness = models.IntegerField(
        default=28,
        help_text="Bubble corner roundness in percentage (0-100)."
    )
    show_bubble_background = models.BooleanField(
        default=True,
        help_text="Whether to show the primary color background for the bubble."
    )
    widget_position = models.CharField(
        max_length=20,
        default='bottom-right',
        help_text="Corner position: bottom-right, bottom-left, top-right, top-left"
    )
    
    # Text
    header_title = models.CharField(max_length=100, default='Chat with AI')
    header_subtitle = models.CharField(max_length=100, default='Online | Powered by Smart Agent')
    placeholder_text = models.CharField(max_length=100, default='Type a message...')
    
    # Advanced
    is_enabled = models.BooleanField(default=True)
    allowed_domains = models.TextField(blank=True, help_text="Comma separated domains (e.g. example.com). Leave blank for all.")
    
    # Multi-Channel
    whatsapp_number = models.CharField(max_length=20, blank=True, null=True, help_text="WhatsApp number with country code")
    messenger_link = models.CharField(max_length=255, blank=True, null=True, help_text="Facebook Messenger link (e.g. m.me/yourpage)")
    
    # Chat Controls
    enable_human_control = models.BooleanField(default=True, help_text="Show Human Help / Resolve button in the widget")
    enable_ai_control = models.BooleanField(default=True, help_text="Show AI Off/On toggle button in the widget")
    
    # FAB Menu Customization
    menu_ai_icon_size = models.IntegerField(default=44, help_text="AI Icon size in the 3-icon menu")
    menu_ai_icon_bg_color = models.CharField(max_length=7, blank=True, null=True, help_text="Background color for AI icon in FAB menu (leave blank for transparent)")
    menu_ai_icon_roundness = models.IntegerField(default=50, help_text="AI Icon corner roundness in percentage (0-100)")

    updated_at = models.DateTimeField(auto_now=True)




    def __str__(self):
        return f"Widget Settings for {self.agent.name}"
