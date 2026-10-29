import uuid
import secrets
from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta


class Customer(models.Model):
    """
    Global customer identity authenticated via Google One-Click / OAuth.
    Across merchants, one Google identity represents one customer account.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    google_sub = models.CharField(max_length=255, unique=True, db_index=True)
    email = models.EmailField(db_index=True)
    name = models.CharField(max_length=255)
    avatar_url = models.URLField(max_length=1000, blank=True, null=True)
    primary_phone = models.CharField(max_length=30, blank=True, null=True, db_index=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer"
        verbose_name_plural = "Customers"
        ordering = ['-created_at']

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return f"{self.name} ({self.email})"



class CustomerShopHistory(models.Model):
    """A customer's remembered merchant relationship across devices."""
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='shop_history')
    merchant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='customer_shop_history')
    last_seen_at = models.DateTimeField(auto_now=True, db_index=True)
    order_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_seen_at']
        constraints = [
            models.UniqueConstraint(fields=['customer', 'merchant'], name='unique_customer_shop_history')
        ]

    def __str__(self):
        return f'{self.customer.name} - {self.merchant.name or self.merchant.email}'


class CustomerIdentity(models.Model):
    """
    Links a Customer to messaging platforms (WhatsApp, Messenger, Telegram, Instagram, etc.)
    and specific agent contacts so chat orders and web orders can be seamlessly unified.
    """
    PLATFORM_CHOICES = [
        ('whatsapp', 'WhatsApp'),
        ('messenger', 'Messenger'),
        ('telegram', 'Telegram'),
        ('instagram', 'Instagram'),
        ('web', 'Web'),
        ('facebook_comment', 'Facebook Comment'),
        ('other', 'Other'),
    ]

    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='identities')
    platform = models.CharField(max_length=30, choices=PLATFORM_CHOICES, db_index=True)
    platform_user_id = models.CharField(max_length=255, db_index=True, help_text="Phone number (WA) or PSID/ID (FB/TG/IG)")
    agent = models.ForeignKey('aiAgent.AgentAI', on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_identities')
    contact = models.ForeignKey('aiAgent.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='customer_identities')
    display_name = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer Identity"
        verbose_name_plural = "Customer Identities"
        unique_together = ('platform', 'platform_user_id', 'agent')

    def __str__(self):
        return f"{self.customer.name} - {self.platform}:{self.platform_user_id}"


class CustomerAddress(models.Model):
    """
    Saved delivery addresses for a Customer.
    Includes courier location mapping (Pathao/Steadfast) for instant checkout.
    """
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, related_name='addresses')
    recipient_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=30, db_index=True)
    full_address = models.TextField()
    district = models.CharField(max_length=100, blank=True, null=True)
    upazila = models.CharField(max_length=100, blank=True, null=True)
    
    # Stores pre-matched courier IDs for Pathao/SteadFast
    # e.g. {"pathao": {"city_id": 1, "zone_id": 12, "area_id": 50}, "steadfast": {"city_id": 1, "area_id": 20}}
    courier_location_ids = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Customer Address"
        verbose_name_plural = "Customer Addresses"
        ordering = ['-is_default', '-created_at']

    def save(self, *args, **kwargs):
        if self.is_default:
            CustomerAddress.objects.filter(customer=self.customer, is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.recipient_name} - {self.full_address[:40]}"


class CourierRiskProfile(models.Model):
    """Persistent, provider-scoped delivery-risk aggregate for a phone hash."""
    PROVIDER_CHOICES = (
        ('platform', 'Platform Orders'),
        ('pathao', 'Pathao'),
        ('steadfast', 'Steadfast'),
        ('redx', 'RedX'),
        ('other', 'Other'),
    )
    RISK_CHOICES = (('unknown', 'Unknown'), ('low', 'Low'), ('medium', 'Medium'), ('high', 'High'))

    merchant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='courier_risk_profiles')
    provider = models.CharField(max_length=30, choices=PROVIDER_CHOICES, db_index=True)
    phone_hash = models.CharField(max_length=64, db_index=True)
    phone_last4 = models.CharField(max_length=4, blank=True, default='')
    total_parcels = models.PositiveIntegerField(default=0)
    delivered_count = models.PositiveIntegerField(default=0)
    returned_count = models.PositiveIntegerField(default=0)
    cancelled_count = models.PositiveIntegerField(default=0)
    success_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    risk_level = models.CharField(max_length=12, choices=RISK_CHOICES, default='unknown')
    first_seen_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    next_sync_at = models.DateTimeField(null=True, blank=True, db_index=True)
    source_status = models.CharField(max_length=30, default='local')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['merchant', 'provider', 'phone_hash'], name='unique_courier_risk_profile_scope')
        ]
        indexes = [
            models.Index(fields=['provider', 'phone_hash']),
            models.Index(fields=['next_sync_at', 'provider']),
        ]

    def __str__(self):
        return f'{self.provider}:{self.phone_last4} ({self.risk_level})'


class CourierRiskEvent(models.Model):
    """Normalized historical parcel event; raw courier payload is never required."""
    profile = models.ForeignKey(CourierRiskProfile, on_delete=models.CASCADE, related_name='events')
    external_order_id = models.CharField(max_length=150)
    status = models.CharField(max_length=30)
    event_at = models.DateTimeField(null=True, blank=True)
    source_order = models.ForeignKey('users.CustomerOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='courier_risk_events')
    payload_digest = models.CharField(max_length=64, blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['profile', 'external_order_id'], name='unique_courier_risk_event')
        ]
        indexes = [
            models.Index(fields=['profile', 'status']),
            models.Index(fields=['event_at']),
        ]


class CourierRiskSyncLog(models.Model):
    STATUS_CHOICES = (('running', 'Running'), ('success', 'Success'), ('partial', 'Partial'), ('failed', 'Failed'))
    merchant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='courier_risk_sync_logs')
    provider = models.CharField(max_length=30)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='running')
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    profiles_seen = models.PositiveIntegerField(default=0)
    events_upserted = models.PositiveIntegerField(default=0)
    error_message = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True)



def generate_short_code():
    # 8-character unique alphanumeric URL-friendly code
    return secrets.token_urlsafe(6).replace('-', '').replace('_', '')[:8]


class CheckoutSession(models.Model):
    """
    Temporary or reusable checkout session created by AI chat or merchant.
    Linked via short URL e.g. shop.newsmartagent.com/c/k7Qx2LpA.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=16, unique=True, db_index=True, default=generate_short_code)
    merchant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='checkout_sessions')
    agent = models.ForeignKey('aiAgent.AgentAI', on_delete=models.SET_NULL, null=True, blank=True, related_name='checkout_sessions')
    contact = models.ForeignKey('aiAgent.Contact', on_delete=models.SET_NULL, null=True, blank=True, related_name='checkout_sessions')
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='checkout_sessions')
    
    # Items prefilled by AI or merchant
    # [{name, quantity, price, variant, image_url, sku}]
    items = models.JSONField(default=list, blank=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    delivery_charge = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=10, default='BDT')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    source_platform = models.CharField(max_length=30, blank=True, null=True)
    expires_at = models.DateTimeField(db_index=True)
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Checkout Session"
        verbose_name_plural = "Checkout Sessions"
        ordering = ['-created_at']

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"Session {self.code} ({self.status}) - {self.merchant.email}"


class StorefrontPromotion(models.Model):
    """
    Promotions, Free Shipping Thresholds, Flash Sales, and Coupons
    configured by the merchant. Fully interconnected with Live Delivery Quote Engine,
    Checkout Session, and AI Sales Assistant.
    """
    PROMOTION_TYPE_CHOICES = [
        ('free_shipping', 'Free Shipping Threshold (ফ্রি ডেলিভারি)'),
        ('percentage_discount', 'Percentage Discount (শতাংশ ছাড়)'),
        ('fixed_discount', 'Fixed Amount Discount (নির্দিষ্ট টাকা ছাড়)'),
        ('buy_x_get_y', 'Buy More, Save More (ভলিউম টিয়ার)'),
        ('coupon_code', 'Coupon / Promo Code (কুপন কোড)'),
    ]

    merchant = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='storefront_promotions')
    title = models.CharField(max_length=150, help_text="ক্যাম্পেইন বা অফারের নাম (যেমন: ঈদ স্পেশাল ফ্রি ডেলিভারি)")
    description = models.TextField(blank=True, default='', help_text="গ্রাহকদের জন্য আকর্ষণীয় বর্ণনা")
    promotion_type = models.CharField(max_length=30, choices=PROMOTION_TYPE_CHOICES, default='free_shipping')
    coupon_code = models.CharField(max_length=50, blank=True, null=True, db_index=True, help_text="যদি কুপন ভিত্তিক অফার হয় (যেমন: EID2026)")

    # Criteria / Conditions
    min_order_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="অফারের জন্য ন্যূনতম অর্ডার মূল্য (৳)")
    min_quantity = models.PositiveIntegerField(default=1, help_text="অফারের জন্য ন্যূনতম পণ্যের সংখ্যা")
    applicable_districts = models.JSONField(default=list, blank=True, help_text="নির্দিষ্ট জেলার নাম (যেমন: ['Dhaka', 'Gazipur']) খালি রাখলে সারা বাংলাদেশ")
    applicable_categories = models.JSONField(default=list, blank=True, help_text="নির্দিষ্ট ক্যাটাগরি")
    applicable_products = models.ManyToManyField('datasheet.Product', blank=True, related_name='promotions')

    # Benefit Values
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, help_text="শতকরা ছাড় (যেমন: 10.00 = 10%)")
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="নির্দিষ্ট টাকার ছাড় (যেমন: 100.00 = ৳১০০)")
    is_free_shipping = models.BooleanField(default=False, help_text="এই অফারে ডেলিভারি চার্জ সম্পূর্ণ ফ্রি কি না")

    # Schedule / Countdown
    start_date = models.DateTimeField(null=True, blank=True, db_index=True, help_text="অফার শুরুর তারিখ ও সময়")
    end_date = models.DateTimeField(null=True, blank=True, db_index=True, help_text="অফার শেষের তারিখ ও সময়")
    show_countdown_timer = models.BooleanField(default=True, help_text="স্টোরফ্রন্টে লাইভ কাউন্টডাউন টাইমার দেখাবে কি না")
    banner_message = models.CharField(max_length=255, blank=True, default='', help_text="হেডারে দেখানোর মেসেজ (যেমন: ⚡ ঈদ ধামাকা: ৳১০০০ এর অর্ডারে ফ্রি ডেলিভারি!)")

    # Usage Limits & Counters
    max_total_usage = models.PositiveIntegerField(null=True, blank=True, help_text="সর্বমোট কতবার ব্যবহার করা যাবে (খালি রাখলে আনলিমিটেড)")
    times_used = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def is_currently_valid(self):
        if not self.is_active:
            return False
        now = timezone.now()
        if self.start_date and now < self.start_date:
            return False
        if self.end_date and now > self.end_date:
            return False
        if self.max_total_usage is not None and self.times_used >= self.max_total_usage:
            return False
        return True

    def __str__(self):
        return f"{self.title} ({self.get_promotion_type_display()}) - {self.merchant.email}"
