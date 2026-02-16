from allauth.account.decorators import secure_admin_login
from django.conf import settings
from django.contrib import admin
from django.contrib.auth import admin as auth_admin
from django.utils.translation import gettext_lazy as _

from .models import OrderForm, CustomerOrder, EmailVerificationToken

from users.forms import UserAdminChangeForm, UserAdminCreationForm
from .models import User, Profile, Payment, Offer, Subscription, Platform, NSATransfer

# Force Django Admin to use allauth login if enabled
if settings.DJANGO_ADMIN_FORCE_ALLAUTH:
    admin.autodiscover()
    admin.site.login = secure_admin_login(admin.site.login)  # type: ignore[method-assign]


@admin.register(User)
class UserAdmin(auth_admin.UserAdmin):
    form = UserAdminChangeForm
    add_form = UserAdminCreationForm

    # Edit view fieldsets
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Personal info"), {"fields": ("name", "phone_number", "gender")}),
        (_("Address info"), {"fields": ("division", "district", "upazila")}),
        (_("Agent info"), {"fields": ("id_type", "created_by")}),
        (_("Permissions"), {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            ),
        }),
        (_("Important dates"), {"fields": ("last_login", "date_joined", "created_at")}),
    )

    # Fields when adding a new user from admin
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "name",
                    "phone_number",
                    "gender",
                    "division",
                    "district",
                    "upazila",
                    "id_type",
                    "created_by",
                ),
            },
        ),
    )

    # List display in user list
    list_display = ["id","email", "name", "phone_number", "division", "is_superuser", "is_staff", "id_type", "created_by", "created_at"]

    # Searchable fields
    search_fields = ["email", "name", "phone_number", "division", "district"]

    # Ordering in admin list
    ordering = ["id"]
    # filter horizontal

    # Readonly fields
    readonly_fields = ["created_at", "last_login", "date_joined"]

# Profile Admin
@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'id_type','word_balance', 'unique_id', 'commission_balance', 'acount_balance', 'created_at', 'updated_at')
    search_fields = ('user__email', 'unique_id')
    list_filter = ('id_type',)

@admin.register(Platform)
class PlatformAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'offer_count']
    list_filter = ['is_active']
    search_fields = ['name']

    @admin.display(description="Offer সংখ্যা")
    def offer_count(self, obj):
        return obj.offers.count()


# Payment Admin
@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'profile','offer',  'amount', 'status', 'created_at')
    search_fields = ('profile__user__email',)
    list_filter = ('status',)

# Offer Admin
class PlatformInline(admin.TabularInline):
    model = Offer.allowed_platforms.through  # through model ব্যবহার করা হচ্ছে
    extra = 1
    verbose_name = "প্ল্যাটফর্ম"
    verbose_name_plural = "প্ল্যাটফর্মসমূহ"


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ['name', 'tokens', 'price', 'duration_days', 'is_active', 'platform_count', 'target_audience']
    inlines = [PlatformInline]

    @admin.display(description="প্ল্যাটফর্ম সংখ্যা")
    def platform_count(self, obj):
        return obj.allowed_platforms.count()

# Subscription Admin
@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('profile', 'offer', 'start_date', 'end_date', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('profile__user__email', 'offer__name')





@admin.register(OrderForm)
class OrderFormAdmin(admin.ModelAdmin):
    # কোন কলামগুলো লিস্টে দেখাবে
    list_display = ('user', 'form_id', 'created_at')
    
    # ইউজার এবং ইউনিক আইডি দিয়ে সার্চ করার অপশন
    search_fields = ('user__username', 'user__profile__unique_id', 'form_id')
    
    # তৈরি হওয়ার তারিখ দিয়ে ফিল্টার
    list_filter = ('created_at',)
    
    # form_id যেহেতু অটো-জেনারেটেড, তাই এটি এডিট করা যাবে না
    readonly_fields = ('form_id', 'created_at')

@admin.register(CustomerOrder)
class CustomerOrderAdmin(admin.ModelAdmin):
    # অ্যাডমিন প্যানেলে অর্ডারের সারসংক্ষেপ দেখার জন্য
    list_display = ('customer_name', 'user', 'product_name', 'status', 'extra_info', 'district', 'upazila', 'created_at')
    
    # স্ট্যাটাস এবং তারিখ অনুযায়ী ফিল্টার
    list_filter = ('status', 'created_at', 'updated_at')
    
    # কাস্টমারের নাম, ফোন বা ইউজারের ইমেইল দিয়ে সার্চ
    search_fields = ('customer_name', 'phone_number', 'user__email', 'product_name')
    
    # সরাসরি লিস্ট ভিউ থেকেই স্ট্যাটাস পরিবর্তন করার সুবিধা
    list_editable = ('status',)
    
    # ডাটা এন্ট্রি করার সময় কিছু ফিল্ড রিড-অনলি রাখা ভালো
    readonly_fields = ('created_at', 'updated_at')
    
    # অর্ডারের ডিটেইলস পেজকে সুন্দরভাবে সাজানো
    fieldsets = (
        ('Customer Info', {
            'fields': ('customer_name', 'phone_number', 'address')
        }),
        ('Order Details', {
            'fields': ('user', 'product_name', 'extra_info', 'status')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',), # এটি ডিফল্টভাবে হাইড থাকবে
        }),
    )
    
@admin.register(EmailVerificationToken)
class EmailVerificationTokenAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'token', 'created_at']


@admin.register(NSATransfer)
class NSATransferAdmin(admin.ModelAdmin):
    # প্যানেলের লিস্টে যে যে কলাম দেখাবে
    list_display = ('id', 'get_sender_id', 'get_receiver_id', 'amount', 'created_at')
    
    # ফিল্টার করার অপশন (ডান পাশে থাকবে)
    list_filter = ('created_at',)
    
    # সার্চ করার বক্স (ইউনিক আইডি দিয়ে সার্চ করা যাবে)
    search_fields = ('sender__profile__unique_id', 'receiver__profile__unique_id', 'amount')
    
    # প্যানেলে রিড-অনলি মোডে রাখা (যাতে অ্যাডমিনও এডিট করে টাকা এদিক ওদিক না করতে পারে)
    readonly_fields = ('sender', 'receiver', 'amount', 'created_at')

    # কাস্টম ফাংশন প্রোফাইল থেকে ইউনিক আইডি দেখানোর জন্য
    def get_sender_id(self, obj):
        return obj.sender.profile.unique_id
    get_sender_id.short_description = 'Sender ID'

    def get_receiver_id(self, obj):
        return obj.receiver.profile.unique_id
    get_receiver_id.short_description = 'Receiver ID'