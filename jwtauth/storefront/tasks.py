import logging
from celery import shared_task
from django.utils import timezone
from users.models import CustomerOrder
from .models import CourierRiskSyncLog
from .services.phone_history import sync_platform_phone_history, sync_steadfast_phone_history, sync_all_configured_phone_history
from .services.checkout_link import get_shop_base_url

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def send_checkout_order_confirmation_task(self, order_id: int):
    """Asynchronously notify customer across all active/linked platforms after an order."""
    try:
        from users.models import CustomerOrder
        from integrations.services.notification_dispatcher import CustomerNotificationDispatcher

        order = CustomerOrder.objects.select_related('user', 'customer', 'contact', 'contact__agent').filter(id=order_id).first()
        if not order:
            logger.error(f"[Storefront] Order {order_id} not found for confirmation task")
            return False

        tracking_url = f"{get_shop_base_url()}/orders/{order.public_id}"
        msg_text = (
            f"✅ ধন্যবাদ {order.customer_name}! আপনার অর্ডারটি সফলভাবে গৃহীত হয়েছে।\n\n"
            f"📦 অর্ডার নম্বর: #{order.id}\n"
            f"💰 মোট মূল্য: ৳{order.price + (order.delivery_charge or 0)}\n"
            f"📍 ডেলিভারি ঠিকানা: {order.address}\n\n"
            f"🚚 লাইভ ট্র্যাক করতে ট্যাপ করুন:\n{tracking_url}"
        )

        dispatch_res = CustomerNotificationDispatcher.dispatch_message(
            order=order,
            message_text=msg_text,
            event_tag="order_confirmation"
        )
        return dispatch_res.get('sent_count', 0) > 0

    except Exception as exc:
        logger.error(f"[Storefront] Failed sending order confirmation message for Order #{order_id}: {exc}")
        return False


@shared_task(bind=True, max_retries=2)
def sync_platform_phone_history_task(self, phone, merchant_id=None):
    try:
        from django.contrib.auth import get_user_model
        merchant = get_user_model().objects.filter(id=merchant_id).first() if merchant_id else None
        sync_platform_phone_history(phone, merchant=merchant)
        return True
    except Exception as exc:
        logger.exception('[CourierRisk] platform sync failed')
        raise self.retry(exc=exc, countdown=60)


@shared_task
def sync_stale_platform_risk_profiles():
    log = CourierRiskSyncLog.objects.create(provider='platform', status='running')
    seen = events = 0
    try:
        phones = CustomerOrder.objects.values_list('phone_number', flat=True).distinct()
        for phone in phones.iterator(chunk_size=500):
            profile = sync_platform_phone_history(phone)
            if profile:
                seen += 1
                events += profile.total_parcels
        log.status = 'success'
        log.profiles_seen = seen
        log.events_upserted = events
        return seen
    except Exception as exc:
        log.status = 'failed'
        log.error_message = str(exc)[:2000]
        raise
    finally:
        log.finished_at = timezone.now()
        log.save(update_fields=['status', 'profiles_seen', 'events_upserted', 'finished_at', 'error_message'])


@shared_task(bind=True, max_retries=2)
def sync_steadfast_phone_history_task(self, phone, merchant_id=None):
    try:
        from django.contrib.auth import get_user_model
        merchant = get_user_model().objects.filter(id=merchant_id).first() if merchant_id else None
        if merchant:
            from .models import CourierRiskProfile
            from .services.phone_history import phone_fingerprint, normalize_phone_number
            fingerprint = phone_fingerprint(normalize_phone_number(phone))
            existing = CourierRiskProfile.objects.filter(merchant=merchant, provider="steadfast", phone_hash=fingerprint).only("next_sync_at").first()
            if existing and existing.next_sync_at and existing.next_sync_at > timezone.now():
                return True
        sync_all_configured_phone_history(phone, merchant=merchant)
        return True
    except Exception as exc:
        logger.exception("[CourierRisk] Steadfast sync failed")
        raise self.retry(exc=exc, countdown=120)


@shared_task
def sync_stale_steadfast_risk_profiles():
    log = CourierRiskSyncLog.objects.create(provider="steadfast", status="running")
    seen = 0
    try:
        pairs = CustomerOrder.objects.exclude(phone_number="").values_list("phone_number", "user_id").distinct()
        from django.contrib.auth import get_user_model
        User = get_user_model()
        for phone, merchant_id in pairs.iterator(chunk_size=500):
            merchant = User.objects.filter(id=merchant_id).first()
            if not merchant:
                continue
            from .models import CourierRiskProfile
            from .services.phone_history import phone_fingerprint, normalize_phone_number
            fingerprint = phone_fingerprint(normalize_phone_number(phone))
            existing = CourierRiskProfile.objects.filter(merchant=merchant, provider="steadfast", phone_hash=fingerprint).only("next_sync_at").first()
            if existing and existing.next_sync_at and existing.next_sync_at > timezone.now():
                continue
            if sync_all_configured_phone_history(phone, merchant=merchant):
                seen += 1
        log.status = "success"
        log.profiles_seen = seen
        return seen
    except Exception as exc:
        log.status = "failed"
        log.error_message = str(exc)[:2000]
        raise
    finally:
        log.finished_at = timezone.now()
        log.save(update_fields=["status", "profiles_seen", "finished_at", "error_message"])
