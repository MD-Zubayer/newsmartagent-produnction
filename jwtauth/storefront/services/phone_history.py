import hashlib
import hmac
import logging
import re
from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from users.models import CustomerOrder
from ..models import CourierRiskProfile, CourierRiskEvent
from courier.models import SteadFastCourierConfig
from courier.views import SteadFastCourierClient

logger = logging.getLogger(__name__)


def normalize_phone_number(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r'\D', '', str(phone))
    if digits.startswith('880'):
        digits = '0' + digits[3:]
    return digits


def phone_fingerprint(phone: str) -> str:
    digits = normalize_phone_number(phone)
    secret = str(getattr(settings, 'COURIER_RISK_HASH_SECRET', settings.SECRET_KEY)).encode()
    return hmac.new(secret, digits.encode(), hashlib.sha256).hexdigest() if digits else ''


def _risk_level(success_rate, total, returned):
    if total == 0:
        return 'unknown'
    if success_rate is None or success_rate >= 80:
        return 'low'
    if success_rate >= 60:
        return 'medium'
    return 'high'


def _refresh_profile(profile):
    events = profile.events.all()
    total = events.count()
    delivered = events.filter(status='delivered').count()
    returned = events.filter(status='returned').count()
    cancelled = events.filter(status='cancelled').count()
    decided = delivered + returned
    success_rate = round((delivered / decided) * 100) if decided else None
    profile.total_parcels = total
    profile.delivered_count = delivered
    profile.returned_count = returned
    profile.cancelled_count = cancelled
    profile.success_rate = success_rate
    profile.risk_level = _risk_level(success_rate, total, returned)
    profile.last_synced_at = timezone.now()
    profile.next_sync_at = timezone.now() + timedelta(hours=6)
    profile.source_status = 'local'
    profile.save(update_fields=[
        'total_parcels', 'delivered_count', 'returned_count', 'cancelled_count',
        'success_rate', 'risk_level', 'last_synced_at', 'next_sync_at',
        'source_status', 'updated_at'
    ])
    return profile


@transaction.atomic
def sync_platform_phone_history(phone: str, merchant=None):
    """Persist current platform order history into normalized risk tables."""
    digits = normalize_phone_number(phone)
    fingerprint = phone_fingerprint(digits)
    if not fingerprint or len(digits) < 10:
        return None

    qs = CustomerOrder.objects.filter(phone_number__endswith=digits[-10:])
    if merchant is not None:
        qs = qs.filter(user=merchant)
    profile, _ = CourierRiskProfile.objects.get_or_create(
        merchant=merchant,
        provider='platform',
        phone_hash=fingerprint,
        defaults={
            'phone_last4': digits[-4:],
            'first_seen_at': qs.order_by('created_at').values_list('created_at', flat=True).first(),
        }
    )

    for order in qs.only('id', 'status', 'created_at').iterator():
        status = order.status if order.status in {'pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'} else 'pending'
        CourierRiskEvent.objects.update_or_create(
            profile=profile,
            external_order_id=f'platform-order-{order.id}',
            defaults={
                'status': status,
                'event_at': order.created_at,
                'source_order_id': order.id,
            }
        )
    return _refresh_profile(profile)


def _external_risk_level(data):
    if data.get('scoring_disabled') or data.get('score') is None:
        return 'unknown'
    try:
        score = float(data.get('score'))
    except (TypeError, ValueError):
        return 'unknown'
    if score >= 80:
        return 'low'
    if score >= 60:
        return 'medium'
    return 'high'


@transaction.atomic
def sync_steadfast_phone_history(phone: str, merchant=None):
    """
    Fetch and persist Steadfast's authorized aggregate risk response.
    If the current merchant does not have an active Steadfast credential,
    it falls back to any active system Steadfast credential so fraud checks
    are never blocked for customers.
    Data is saved both under merchant-scope (if merchant provided) and global-scope (merchant=None)
    so all sellers in the platform benefit from previously checked numbers.
    """
    digits = normalize_phone_number(phone)
    fingerprint = phone_fingerprint(digits)
    if not fingerprint or len(digits) < 10:
        return None

    config = None
    if merchant:
        config = SteadFastCourierConfig.objects.filter(user=merchant, is_active=True).order_by('-updated_at').first()
    if not config:
        config = SteadFastCourierConfig.objects.filter(is_active=True).order_by('-updated_at').first()
    if not config:
        return None

    try:
        data = SteadFastCourierClient(config).get_fraud_check_score(digits)
    except Exception as exc:
        logger.warning("[CourierRisk] Steadfast API call failed for %s: %s", digits[-4:], exc)
        return None

    delivered = int(data.get('delivered_count') or 0)
    cancelled = int(data.get('cancelled_count') or 0)
    now = timezone.now()
    metadata = {
        'volume_band': data.get('volume_band'), 'volume_range': data.get('volume_range'),
        'cancellation_ratio': data.get('cancellation_ratio'), 'total_reports': data.get('total_reports'),
        'fraud_categories': data.get('fraud_categories') or [], 'score': data.get('score'),
        'level': data.get('level'), 'reasons': data.get('reasons') or [],
        'scoring_disabled': bool(data.get('scoring_disabled')),
        'doubtful_reports': bool(data.get('doubtful_reports')),
    }
    risk_level = _external_risk_level(data)
    success_rate = int(data.get('delivery_ratio')) if data.get('delivery_ratio') is not None else None

    # Save to global / cross-seller cache (merchant=None)
    global_profile, _ = CourierRiskProfile.objects.get_or_create(
        merchant=None, provider='steadfast', phone_hash=fingerprint,
        defaults={'phone_last4': digits[-4:]},
    )
    global_profile.phone_last4 = digits[-4:]
    global_profile.total_parcels = delivered + cancelled
    global_profile.delivered_count = delivered
    global_profile.cancelled_count = cancelled
    global_profile.returned_count = cancelled
    global_profile.success_rate = success_rate
    global_profile.risk_level = risk_level
    global_profile.first_seen_at = global_profile.first_seen_at or now
    global_profile.last_synced_at = now
    global_profile.next_sync_at = now + timedelta(hours=6)
    global_profile.source_status = 'external'
    global_profile.metadata = metadata
    global_profile.save()

    # Also save under merchant if specific merchant requested
    target_profile = global_profile
    if merchant:
        m_profile, _ = CourierRiskProfile.objects.get_or_create(
            merchant=merchant, provider='steadfast', phone_hash=fingerprint,
            defaults={'phone_last4': digits[-4:]},
        )
        m_profile.phone_last4 = digits[-4:]
        m_profile.total_parcels = delivered + cancelled
        m_profile.delivered_count = delivered
        m_profile.cancelled_count = cancelled
        m_profile.returned_count = cancelled
        m_profile.success_rate = success_rate
        m_profile.risk_level = risk_level
        m_profile.first_seen_at = m_profile.first_seen_at or now
        m_profile.last_synced_at = now
        m_profile.next_sync_at = now + timedelta(hours=6)
        m_profile.source_status = 'external'
        m_profile.metadata = metadata
        m_profile.save()
        target_profile = m_profile

    return target_profile


def _profile_response(profile, phone):
    if not profile:
        return None
    if profile.provider == 'steadfast':
        badge = (f'🚚 Steadfast: {profile.success_rate}% delivery ({profile.total_parcels}টি)'
                 if profile.success_rate is not None else '🚚 Steadfast delivery history পাওয়া গেছে')
    elif profile.success_rate is None or profile.success_rate >= 80:
        badge = f'🏆 {profile.success_rate or 100}% সাকসেস রেট ({profile.total_parcels}টি অর্ডার)'
    elif profile.success_rate >= 60:
        badge = f'⚠️ {profile.success_rate}% সাকসেস রেট ({profile.returned_count}টি রিটার্ন)'
    else:
        badge = f'🚨 {profile.success_rate}% সাকসেস রেট ({profile.returned_count}টি রিটার্ন / {profile.total_parcels} মোট)'
    return {
        'phone': phone, 'total_orders': profile.total_parcels,
        'delivered': profile.delivered_count, 'returned': profile.returned_count,
        'cancelled': profile.cancelled_count, 'success_rate': profile.success_rate,
        'risk_level': profile.risk_level, 'badge_text': badge,
        'is_new_customer': profile.total_parcels == 0, 'source': profile.provider,
        'source_status': profile.source_status,
        'last_synced_at': profile.last_synced_at.isoformat() if profile.last_synced_at else None,
    }


def sync_all_configured_phone_history(phone: str, merchant=None):
    """
    Sync external provider risk statistics for a phone number across all
    supported courier networks (Steadfast API, Pathao Playwright Scraper, etc.),
    regardless of whether this individual merchant has individual courier accounts.
    """
    profiles = []
    # 1. Steadfast instant API
    try:
        profile = sync_steadfast_phone_history(phone, merchant=merchant)
        if profile:
            profiles.append(profile)
    except Exception:
        logger.exception("[CourierRisk] Steadfast fraud check sync failed")

    # 2. Trigger Playwright scraper task for Pathao
    try:
        from courier.tasks import scrape_courier_fraud_history_task
        scrape_courier_fraud_history_task.delay(phone, merchant.id if merchant else None)
        logger.info("[CourierRisk] Dispatched scrape_courier_fraud_history_task for %s", phone)
    except Exception as e:
        logger.warning("[CourierRisk] Failed to queue async Playwright courier scrape: %s", e)

    return profiles


def get_phone_delivery_profile(phone: str, merchant=None) -> dict:
    digits = normalize_phone_number(phone)
    if not digits or len(digits) < 10:
        return {
            'phone': phone, 'total_orders': 0, 'delivered': 0, 'returned': 0, 'cancelled': 0,
            'success_rate': None, 'risk_level': 'unknown',
            'badge_text': 'সঠিক ফোন নম্বর দিলে delivery history দেখা যাবে',
            'is_new_customer': True, 'source': 'none', 'last_synced_at': None
        }
    fingerprint = phone_fingerprint(digits)

    # 1. Check if we have an existing fresh profile in DB (merchant-scoped or global)
    profile = (
        CourierRiskProfile.objects.filter(
            merchant=merchant, provider='steadfast', phone_hash=fingerprint
        ).first()
        or CourierRiskProfile.objects.filter(
            merchant=None, provider='steadfast', phone_hash=fingerprint
        ).first()
    )

    # 2. If no profile exists or cache is stale (>6 hours), trigger live sync across courier network
    if not profile or not profile.next_sync_at or profile.next_sync_at <= timezone.now():
        try:
            refreshed = sync_all_configured_phone_history(digits, merchant=merchant)
            if refreshed:
                profile = refreshed[0]
        except Exception:
            logger.exception('[CourierRisk] Multi-courier fraud check failed; using persisted data if available')

    if profile:
        return _profile_response(profile, phone)

    # 3. Fallback to platform-wide internal order delivery history
    platform = (
        CourierRiskProfile.objects.filter(
            merchant=merchant, provider='platform', phone_hash=fingerprint
        ).first()
        or CourierRiskProfile.objects.filter(
            merchant=None, provider='platform', phone_hash=fingerprint
        ).first()
    )

    if not platform or not platform.next_sync_at or platform.next_sync_at <= timezone.now():
        platform = sync_platform_phone_history(digits, merchant=merchant)

    if platform and platform.total_parcels > 0:
        return _profile_response(platform, phone)

    return {
        'phone': phone, 'total_orders': 0, 'delivered': 0, 'returned': 0, 'cancelled': 0,
        'success_rate': None, 'risk_level': 'unknown',
        'badge_text': '🆕 নতুন কাস্টমার', 'is_new_customer': True,
        'source': 'platform', 'last_synced_at': None
    }

