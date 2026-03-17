from django.db import models
from users.models import User


class WhatsAppInstance(models.Model):
    """
    একটি User-এর WhatsApp instance (Baileys connection) এর তথ্য।
    """
    STATUS_CHOICES = [
        ('open', 'Connected'),
        ('connecting', 'Connecting'),
        ('close', 'Disconnected'),
    ]

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='whatsapp_instance',
    )
    instance_name = models.CharField(max_length=100, default='default')
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    baileys_api_url = models.URLField(
        default='http://newsmartagent-baileys:3001',
        help_text='Baileys REST API URL (docker internal)'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='close',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'WhatsApp Instance'
        verbose_name_plural = 'WhatsApp Instances'

    def __str__(self):
        return f"{self.user.email} - {self.phone_number or 'Not connected'}"


class WhatsAppMessage(models.Model):
    """
    Incoming/Outgoing WhatsApp message log।
    """
    DIRECTION_CHOICES = [
        ('incoming', 'Incoming'),
        ('outgoing', 'Outgoing'),
    ]

    instance = models.ForeignKey(
        WhatsAppInstance,
        on_delete=models.CASCADE,
        related_name='messages',
        null=True, blank=True,
    )
    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    from_phone = models.CharField(max_length=50)
    to_phone = models.CharField(max_length=50, blank=True)
    push_name = models.CharField(max_length=100, blank=True)
    message_text = models.TextField()
    message_id = models.CharField(max_length=100, blank=True)
    ai_reply = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'WhatsApp Message'
        verbose_name_plural = 'WhatsApp Messages'
        ordering = ['-timestamp']

    def __str__(self):
        return f"[{self.direction}] {self.from_phone}: {self.message_text[:50]}"
