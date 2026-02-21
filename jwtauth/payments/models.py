from django.db import models
from django.conf import settings
# Create your models here.




class CashOutRequest(models.Model):
    
    
    STATUS_CHOICES = [
        ('pending', 'Pendig'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    METHOD_CHOICES = [
        ('bkash', 'bKash'),
        ('nagad', 'Nagad'),
        ('rocket', 'Rocket'),
    ]
    
    ACCOUNT_TYPE = [
        ('personal', 'Personal'),
        ('agent', 'Agent'),
    ]
    
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cash_out')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE)
    receiver_number = models.CharField(max_length=15)

    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_note = models.TextField(blank=True, null=True, help_text="রিজেক্ট করলে কারণ এখানে লিখুন")
    user_note = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - {self.amount} ({self.status})"