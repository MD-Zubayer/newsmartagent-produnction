from django.contrib import admin
from unfold.admin import ModelAdmin
from .models import Customer, CustomerIdentity, CustomerAddress, CheckoutSession, CourierRiskProfile, CourierRiskEvent, CourierRiskSyncLog


@admin.register(Customer)
class CustomerAdmin(ModelAdmin):
    list_display = ('name', 'email', 'primary_phone', 'created_at')
    search_fields = ('name', 'email', 'primary_phone', 'google_sub')
    list_filter = ('created_at',)


@admin.register(CustomerIdentity)
class CustomerIdentityAdmin(ModelAdmin):
    list_display = ('customer', 'platform', 'platform_user_id', 'agent', 'created_at')
    search_fields = ('platform_user_id', 'customer__name', 'customer__email')
    list_filter = ('platform', 'created_at')


@admin.register(CustomerAddress)
class CustomerAddressAdmin(ModelAdmin):
    list_display = ('customer', 'recipient_name', 'phone', 'district', 'upazila', 'is_default')
    search_fields = ('recipient_name', 'phone', 'full_address', 'customer__email')
    list_filter = ('is_default', 'district')


@admin.register(CheckoutSession)
class CheckoutSessionAdmin(ModelAdmin):
    list_display = ('code', 'merchant', 'status', 'total_price', 'currency', 'source_platform', 'expires_at', 'created_at')
    search_fields = ('code', 'merchant__email', 'customer__email', 'contact__identifier')
    list_filter = ('status', 'source_platform', 'created_at')


@admin.register(CourierRiskProfile)
class CourierRiskProfileAdmin(ModelAdmin):
    list_display = ('provider', 'merchant', 'phone_last4', 'total_parcels', 'delivered_count', 'returned_count', 'risk_level', 'last_synced_at')
    search_fields = ('phone_last4', 'merchant__email')
    list_filter = ('provider', 'risk_level', 'source_status')


@admin.register(CourierRiskEvent)
class CourierRiskEventAdmin(ModelAdmin):
    list_display = ('profile', 'external_order_id', 'status', 'event_at', 'source_order')
    search_fields = ('external_order_id', 'profile__phone_last4')
    list_filter = ('status', 'profile__provider')


@admin.register(CourierRiskSyncLog)
class CourierRiskSyncLogAdmin(ModelAdmin):
    list_display = ('provider', 'merchant', 'status', 'profiles_seen', 'events_upserted', 'started_at', 'finished_at')
    list_filter = ('provider', 'status', 'started_at')
