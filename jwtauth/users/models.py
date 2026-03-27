from django.db import models
from django.contrib.auth.models import AbstractUser
from .managers import UserManager
from django.utils.translation import gettext_lazy as _
from django.urls import reverse
from django.conf import settings
import random
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction
import uuid
import phonenumbers
from phonenumbers import geocoder
from .validators import validate_international_phone
from aiAgent.models import AIProviderModel
from minio_management.storages import ProfileStorage
# Create your models here.


class User(AbstractUser):
    ID_TYPE_CHOICES = (
        ('agent', 'Agent ID'),
        ('user', 'User ID'),
    )

    CREATED_BY_CHOICES = (
        ('self', 'Self'),
        ('agent', 'agent'),
    )
    username = None
    name = models.CharField(_("Name of User"), blank=True, max_length=255)
    phone_number = models.CharField("Phone Number", blank=True, max_length=20, validators=[validate_international_phone],help_text="Enter number with country code (e.g. +88017...)")
    country = models.CharField(_('Country'), max_length=100, blank=True)
    id_type = models.CharField("ID Type", max_length=20, choices=ID_TYPE_CHOICES, blank=True)
    email = models.EmailField(unique=True)
    division = models.CharField(
        _("Division"),
        max_length=100,
        blank=True,
    )
    district = models.CharField(
        _("District"),
        max_length=100,
        blank=True,
    )
    upazila = models.CharField(
        _("Upazila"),
        max_length=100,
        blank=True,
    )

    created_by = models.CharField(
        _("Created By"),
        max_length=20,
        choices=CREATED_BY_CHOICES,
        blank=True,
    ) 
    gender = models.CharField(
        max_length=10, 
        choices=[('M', 'Male'), ('F', 'Female'), ('O', 'Other')], 
        blank=True
    )
    
    is_verified = models.BooleanField(default=False)
    two_factor_enabled = models.BooleanField(default=False)
    two_factor_secret = models.CharField(max_length=32, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def get_absolute_url(self) -> str:
        """Get URL for user's detail view.

        Returns:
            str: URL for user detail.

        """
        return reverse("users:detail", kwargs={"id": self.id})

    def save(self, *args, **kwargs):
        if self.phone_number:
            try:
                parsed = phonenumbers.parse(self.phone_number, None)

                if not self.country:
                    self.country = geocoder.description_for_number(parsed, 'en')

                self.phone_number = phonenumbers.format_number(
                    parsed, phonenumbers.PhoneNumberFormat.E164
                )
            except Exception as e:
                 print(f"Phone processing error: {e}")
        super().save(*args, **kwargs)

#  python3 manage.py generate_ids   after connect postgressql!!!!
class UniqueIDPool(models.Model):
    uid = models.CharField(max_length=10, unique=True)
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f'{self.uid} | {'Used' if self.is_used else 'Free'}'



class Profile(models.Model):
    ID_TYPE_CHOICES = (
        ("agent", "Agent"),
        ("user", "User"),
    )


    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile')
    profile_photo = models.ImageField(upload_to='photos/', storage=ProfileStorage(), null=True, blank=True)
    id_type = models.CharField(max_length=10, choices=ID_TYPE_CHOICES)
    unique_id = models.CharField(max_length=10, unique=True)
    word_balance = models.PositiveBigIntegerField(default=0)
    commission_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, blank=True, null=True)
    acount_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    otp_code = models.CharField(max_length=6, blank=True, null=True)
    otp_created_at = models.DateTimeField(blank=True, null=True)
    two_factor_enabled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def sync_word_balance(self):
        """
        সকল একটিভ সাবস্ক্রিপশনের অবশিষ্ট টোকেন যোগ করে প্রোফাইলের word_balance আপডেট করে।
        """
        from django.apps import apps
        from django.db.models import Sum
        from django.utils import timezone
        
        Subscription = apps.get_model('users', 'Subscription')
        
        # একটিভ এবং মেয়াদের মধ্যে থাকা সকল সাবস্ক্রিপশনের টোকেন যোগ করা
        active_subs = Subscription.objects.filter(
            profile=self, 
            is_active=True,
            end_date__gt=timezone.now()
        )
        
        total_remaining = active_subs.aggregate(total=Sum('remaining_tokens'))['total'] or 0

        # প্রোফাইলের word_balance আপডেট
        self.word_balance = total_remaining
        self.save(update_fields=['word_balance'])
        
        print(f"✅ SYNC: {self.user.email} | Total Active Tokens Summed: {total_remaining} from {active_subs.count()} subs")
            
    def __str__(self):
        return f"{self.user.email} | {self.id_type} | {self.unique_id}"



class Platform(models.Model):
    name = models.CharField(max_length=50, unique=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name




class Offer(models.Model):
    
    TAGET_AUDIENCE = [
        ('all', 'All Users'),
        ('created_by_agent', 'Created By Agent')
    ]
    
    allowed_platforms = models.ManyToManyField(Platform, related_name='offers')
    allowed_models = models.ManyToManyField('aiAgent.AIProviderModel', related_name='offers', blank=True)
    tokens = models.PositiveIntegerField()
    shorthand_choices = models.CharField(max_length=10, blank=True, null=True)
    name = models.CharField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    price = models.IntegerField()
    duration_days = models.IntegerField(default=30)
    is_active = models.BooleanField(default=True)
    target_audience = models.CharField(max_length=20, choices=TAGET_AUDIENCE, default='all')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} | {self.tokens}| {self.shorthand_choices} | {self.price}  | {self.duration_days}'



class Payment(models.Model):

    PAYMENT_TYPE = (
        ('subscription', 'Subscription'),
        ('balance', 'Add Balance'),
    )
    
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, blank=True, null=True, related_name='profile_payments')
    payment_type = models.CharField(max_length=20, choices=PAYMENT_TYPE, default='subscription')
    offer = models.ForeignKey(Offer,on_delete=models.SET_NULL, related_name='offer_payments', blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=[('pending','Pending'),('paid','Paid'),('failed','Failed')])
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_response = models.JSONField(null=True, blank=True)
    currency = models.CharField(max_length=10, default='BDT', blank=True, null=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    def __str__(self):
        return f"{self.profile.user.email} - {self.amount} BDT - {self.status}"

    
    def save(self, *args, **kwargs):
        # <!------------------# Checking if it was already paid or not -------------------------!>
        old_status = None
        if self.pk:
            try:

                old_status = Payment.objects.get(pk=self.pk).status
            except Payment.DoesNotExist:
                old_status = None

        super(Payment, self).save(*args, **kwargs)
        print(f"Model Level DEBUG: Saved ID is {self.id}")
        
    
            #<!----------------- If the status is now 'paid' and was not paid before -------------------!>
        if self.status == 'paid' and old_status != 'paid':
            #<!---------------- It is safe to use atomic transactions so that if one fails, the other does not. -------------------!>
            with transaction.atomic():
                profile = self.profile
                offer = self.offer

                notif_msg = ""
            #<!---------------- The new token will be added to the previous token in the profile ------------------!>
                if self.transaction_id == 'BALANCE_PURCHASE' and offer:
                    
                    notif_msg = f"Subscription  activate using balance! after verify {offer.tokens} tokens added."


                if offer:
                    from .models import Subscription
                    #<!---------------------- If you have a previous active subscription, deactivate it (since the token has gone to the profile) ----------------!>
                    # Subscription.objects.filter(profile=profile, is_active=True).update(is_active=False)
                    #<! ----------------- Create subscription for new term ---------------!>
                    Subscription.objects.create(
                        profile=profile,
                        offer=offer,
                        payment=self,
                        start_date=timezone.now(),
                        end_date=timezone.now() + timedelta(days=offer.duration_days),
                        is_active=True,
                        remaining_tokens=offer.tokens
                    )
                    profile.sync_word_balance()
                    if not notif_msg:
                        notif_msg = f"Payment Successful! {offer.price} plan activated. {offer.tokens} words added."

                elif self.payment_type == 'balance' or not offer:
                    profile.acount_balance += int(self.amount)
                    profile.save()
                    notif_msg = f"Success! {self.amount} BDT added to your account balance."

                if notif_msg:
                    try:
                        from chat.models import Notification
                        Notification.objects.create(
                            user=profile.user,
                            message=notif_msg,
                            type='payment_success'
                        )
                        print(f"DEBUG: Notification created for {profile.user.email}")
                    except Exception as e:
                        print(f"DEBUG: Notification Error: {e}")










class Subscription(models.Model):
    profile = models.ForeignKey('users.Profile', on_delete=models.CASCADE)
    offer = models.ForeignKey(Offer, on_delete=models.SET_NULL, null=True)
    payment = models.OneToOneField(Payment, on_delete=models.CASCADE, null=True)
    start_date = models.DateTimeField(default=datetime.now)
    end_date = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    remaining_tokens = models.PositiveBigIntegerField(default=0) # Track tokens separately per subscription
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.end_date and self.offer:
            self.end_date = self.start_date + timedelta(days=self.offer.duration_days)

        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.profile.user.email}  | {self.profile.unique_id}'






class OrderForm(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='order_form')
    form_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Form for {self.user.profile.unique_id}"

class CustomerOrder(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered')
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='order')
    customer_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=20)
    district = models.CharField(max_length=30, null=True, blank=True)
    upazila = models.CharField(max_length=30, blank=True, null=True)
    address = models.TextField()
    product_name = models.CharField(max_length=255, null=True, blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    extra_info = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20,choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.customer_name} -> {self.user.email}"



class EmailVerificationToken(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_valid(self):
        
        expiry_time = self.created_at + timedelta(hours=1)
        return timezone.now() <= expiry_time



class NSATransfer(models.Model):
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_transfers")
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_transfers')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        try:
            
            return f"{self.sender.profile.unique_id} -> {self.receiver.profile.unique_id} | {self.amount} BDT"

        except:
            return f"Transfer {self.id}"        


class FacebookPage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='facebook_pages')
    page_id = models.CharField(max_length=255, unique=True)
    page_name = models.CharField(max_length=255)
    access_token = models.CharField(max_length=500)
    user_access_token = models.CharField(max_length=500, blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True, help_text="Expiry of the user long-lived token, if provided")
    instagram_business_account_id = models.CharField(max_length=255, blank=True, null=True)
    instagram_username = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.page_name} ({self.page_id}) - {self.user.email}"

    @property
    def is_token_valid(self):
        if not self.token_expires_at:
            return True
        return self.token_expires_at > timezone.now()


class WithdrawMethod(models.Model):
    METHOD_CHOICES = (
        ('bkash', 'bKash'),
        ('nagad', 'Nagad'),
        ('rocket', 'Rocket'),
        ('bank', 'Bank Transfer'),
        ('card', 'Bank Card (Debit/Credit)'),
    )
    CARD_TYPE_CHOICES = (
        ('visa', 'Visa'),
        ('mastercard', 'Mastercard'),
        ('amex', 'American Express'),
        ('other', 'Other'),
    )
    ACCOUNT_TYPE_CHOICES = (
        ('personal', 'Personal'),
        ('agent', 'Agent'),
        ('merchant', 'Merchant'),
    )
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='withdraw_methods')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, blank=True, null=True) # Applicable to bKash, Nagad, Rocket
    account_number = models.CharField(max_length=50)
    account_name = models.CharField(max_length=100, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    branch_name = models.CharField(max_length=100, blank=True, null=True)
    routing_number = models.CharField(max_length=50, blank=True, null=True)
    # Card-specific fields
    card_holder_name = models.CharField(max_length=100, blank=True, null=True)
    card_type = models.CharField(max_length=20, choices=CARD_TYPE_CHOICES, blank=True, null=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        type_str = f"({self.account_type.title()})" if self.account_type else ""
        return f"{self.method.upper()} {type_str} - {self.account_number} ({self.profile.unique_id})"


class CashoutRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    BALANCE_CHOICES = (
        ('account', 'Account Balance'),
        ('commission', 'Commission Balance'),
    )
    profile = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='cashout_requests')
    withdraw_method = models.ForeignKey(WithdrawMethod, on_delete=models.SET_NULL, null=True)
    balance_type = models.CharField(max_length=20, choices=BALANCE_CHOICES, default='commission')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    admin_note = models.TextField(blank=True, null=True)
    requested_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.profile.unique_id} - {self.balance_type.upper()} - {self.amount} BDT - {self.status}"


class YouTubeChannel(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='youtube_channels')
    channel_id = models.CharField(max_length=255, unique=True)
    channel_title = models.CharField(max_length=255)
    access_token = models.CharField(max_length=500)
    refresh_token = models.CharField(max_length=500, blank=True, null=True)
    token_expires_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    last_comment_check = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.channel_title} ({self.channel_id}) - {self.user.email}"
