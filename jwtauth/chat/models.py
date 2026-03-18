from django.db import models
from django.conf import settings

# Create your models here.


class Conversation(models.Model):

    PLATFORM_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('messenger', 'Messenger'),
    ]
    agentAi = models.ForeignKey('aiAgent.AgentAi', on_delete=models.CASCADE, related_name='conversations')
    contact_id = models.CharField(max_length=100)
    contact_name = models.CharField(max_length=120, blank=True, null=True)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES, default='messenger')

    status = models.CharField(default='open', max_length=20)

    last_message_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        unique_together = ['agentAi', 'contact_id', 'platform']
        indexes = [
            models.Index(fields=['agentAi', 'contact_id', 'platform']),
        ]

    
class Message(models.Model):
    ROLE_CHOICES = [
        ('user', 'User'),
        ('assistant', 'AI'),
        ('system', 'System')
    ]

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')

    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    platform = models.CharField(max_length=20, choices=Conversation.PLATFORM_CHOICES, default='messenger')

    tokens_used = models.IntegerField(default=0)

    sent_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['sent_at']


class Contact(models.Model):
    name = models.CharField(max_length=50)
    email = models.EmailField(max_length=50)
    subjects = models.CharField(max_length=255)
    messages = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)


class Notification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    type = models.CharField(max_length=20, default='info')
    created_at = models.DateTimeField(auto_now_add=True)


class PostCache(models.Model):
    post_id = models.CharField(max_length=255, unique=True)
    summary = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

