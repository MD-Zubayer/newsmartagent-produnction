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


class AgentAISettings(models.Model):
    """
    Per-Agent specific settings.
    Stored in the 'settings' app to separate configuration from core agent logic.
    """
    agent = models.OneToOneField(
        'aiAgent.AgentAI', 
        on_delete=models.CASCADE, 
        related_name='agent_settings'
    )
    history_limit = models.PositiveIntegerField(
        default=3, 
        help_text="কয়টি পুরনো মেসেজ এআই-এর কাছে হিস্টোরি হিসেবে পাঠানো হবে? (Default: 3)"
    )
    temperature = models.FloatField(default=0.7)
    max_tokens = models.IntegerField(default=200)
    skip_history = models.BooleanField(default=False)
    history_skip_keywords = models.TextField(blank=True, null=True)
    shared_cache_agents = models.ManyToManyField(
        'aiAgent.AgentAI',
        blank=True,
        related_name='shared_by_settings',
        help_text="অন্য কোনো এজেন্টদের ক্যাশ শেয়ার করতে চাইলে সেই এজেন্টগুলো সিলেক্ট করুন।"
    )
    redis_cache_enabled = models.BooleanField(
        default=False,
        help_text="রেডিস মেসেজ ক্যাশিং চালু করতে চান কি না?"
    )
    global_cache_enabled = models.BooleanField(
        default=True,
        help_text="গ্লোবাল ক্যাশিং (সবার জন্য প্রযোজ্য সাধারণ উত্তর) চালু রাখতে চান কি না?"
    )
    sender_cache_enabled = models.BooleanField(
        default=True,
        help_text="সেন্ডার-স্পেসিফিক ক্যাশিং (ইউজার ভিত্তিক উত্তর) চালু রাখতে চান কি না?"
    )
    agent_cache_enabled = models.BooleanField(
        default=True,
        help_text="এজেন্ট-স্পেসিফিক ক্যাশিং (মার্চেন্ট তথ্য সংক্রান্ত উত্তর) চালু রাখতে চান কি না?"
    )

    def __str__(self):
        return f"Settings for Agent: {self.agent.id}"

    @classmethod
    def get_for_agent(cls, agent):
        obj, created = cls.objects.get_or_create(agent=agent)
        return obj


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
    image_caption_provider = models.CharField(
        max_length=20,
        choices=[('gemini', 'Gemini'), ('openai', 'OpenAI')],
        default='gemini',
        help_text='Default provider to generate image captions for the system.'
    )
    youtube_check_interval = models.PositiveIntegerField(
        default=1,
        help_text="How often to check for new YouTube comments (in minutes)."
    )
    payment_verify_threshold = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=2000.00,
        help_text="Automatic payment verification maximum threshold (BDT). Submissions above this will go to pending manual review."
    )
    global_redis_cache_enabled = models.BooleanField(
        default=True,
        help_text="System-wide Redis response caching master switch. Disabling this bypasses response cache for every agent."
    )
    
    class Meta:
        verbose_name = "Global Setting"
        verbose_name_plural = "Global Settings"

    def save(self, *args, **kwargs):
        # Ensure only one instance exists.
        self.pk = 1
        super().save(*args, **kwargs)
        
        # Sync with Celery PeriodicTask if django_celery_beat is installed
        try:
            from django_celery_beat.models import PeriodicTask, IntervalSchedule
            import json

            schedule, created = IntervalSchedule.objects.get_or_create(
                every=self.youtube_check_interval,
                period=IntervalSchedule.MINUTES,
            )
            
            PeriodicTask.objects.update_or_create(
                name='check-youtube-comments',
                defaults={
                    'task': 'webhooks.youtube_tasks.check_youtube_comments',
                    'interval': schedule,
                    'enabled': True,
                    'args': json.dumps([]),
                    'kwargs': json.dumps({}),
                }
            )
        except Exception as e:
            print(f"Error syncing YouTube check interval: {e}")

    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "System Global Settings"



def _default_comment_templates():
    return ["ধন্যবাদ! আপনার ইনবক্স চেক করুন, বিস্তারিত পাঠানো হয়েছে। 😊"]


class CommentAutomationSettings(models.Model):
    """
    Per-agent (Facebook Page / Instagram account) public comment automation settings.
    If no row exists for an agent, the legacy comment behaviour is kept untouched.
    """
    MODE_CHOICES = [
        ('off', 'Off'),
        ('fixed', 'Fixed template'),
        ('ai', 'AI smart reply'),
        ('hybrid', 'Hybrid (AI intent + rules)'),
    ]

    agent = models.OneToOneField(
        'aiAgent.AgentAI',
        on_delete=models.CASCADE,
        related_name='comment_settings',
    )
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='hybrid')
    public_reply_enabled = models.BooleanField(default=True)
    private_dm_enabled = models.BooleanField(default=True)
    hide_spam_enabled = models.BooleanField(default=True)
    reply_to_nested = models.BooleanField(
        default=False,
        help_text="কমেন্টের রিপ্লাই (nested) এর উত্তরও দেবে কি না?",
    )
    fixed_templates = models.JSONField(default=_default_comment_templates, blank=True)
    fixed_dm_template = models.TextField(blank=True, default='')
    reply_delay_min = models.PositiveIntegerField(default=10)
    reply_delay_max = models.PositiveIntegerField(default=40)
    hourly_reply_limit = models.PositiveIntegerField(default=60)
    daily_ai_comment_limit = models.PositiveIntegerField(
        default=300,
        help_text="দিনে সর্বোচ্চ কয়টি কমেন্টে AI ব্যবহার হবে (টোকেন সুরক্ষা)।",
    )
    low_balance_threshold = models.PositiveIntegerField(
        default=2000,
        help_text="টোকেন ব্যালেন্স এর নিচে নামলে AI বন্ধ হয়ে Fixed মোডে নামবে।",
    )
    confidence_threshold = models.FloatField(default=0.6)
    hide_confidence_threshold = models.FloatField(default=0.85)
    only_post_ids = models.JSONField(
        default=list, blank=True,
        help_text="খালি হলে সব পোস্ট। নাহলে শুধু এই পোস্টগুলো।",
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"CommentAutomation({self.agent_id}, {self.mode})"

    @classmethod
    def get_active_for_agent(cls, agent):
        try:
            return cls.objects.filter(agent=agent, is_active=True).first()
        except Exception:
            return None


class CommentActivityLog(models.Model):
    STATUS_CHOICES = [
        ('done', 'Done'),
        ('review', 'Needs review'),
        ('skipped', 'Skipped'),
        ('failed', 'Failed'),
    ]

    agent = models.ForeignKey(
        'aiAgent.AgentAI', on_delete=models.CASCADE, related_name='comment_logs'
    )
    platform = models.CharField(max_length=30, db_index=True)
    comment_id = models.CharField(max_length=255, db_index=True)
    post_id = models.CharField(max_length=255, blank=True, default='')
    commenter_id = models.CharField(max_length=255, blank=True, default='')
    commenter_name = models.CharField(max_length=255, blank=True, default='')
    comment_text = models.TextField(blank=True, default='')
    mode_used = models.CharField(max_length=20, blank=True, default='')
    intent = models.CharField(max_length=40, blank=True, default='')
    confidence = models.FloatField(default=0.0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='done', db_index=True)
    skip_reason = models.CharField(max_length=80, blank=True, default='')
    public_reply_text = models.TextField(blank=True, default='')
    public_reply_sent = models.BooleanField(default=False)
    dm_text = models.TextField(blank=True, default='')
    dm_sent = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)
    tokens_used = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.platform}:{self.comment_id}:{self.status}"


class PostContextNote(models.Model):
    """Seller-written one-line context for a post/video (zero AI cost)."""
    agent = models.ForeignKey(
        'aiAgent.AgentAI', on_delete=models.CASCADE, related_name='post_context_notes'
    )
    post_id = models.CharField(max_length=255, db_index=True)
    note = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('agent', 'post_id')

    def __str__(self):
        return f"{self.agent_id}:{self.post_id}"
