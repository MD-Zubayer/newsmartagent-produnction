import logging
import time
from celery import shared_task
from django.db import transaction
from .models import PathaoCourierConfig, PathaoCity, PathaoZone, PathaoArea
from .views import PathaoCourierClient

logger = logging.getLogger(__name__)

@shared_task
def sync_pathao_locations():
    """
    Syncs Cities, Zones, and Areas from Pathao API to local database.
    Requires at least one active PathaoCourierConfig to get the access token.
    """
    config = PathaoCourierConfig.objects.filter(is_active=True).first()
    if not config:
        logger.warning("No active PathaoCourierConfig found. Cannot sync Pathao locations.")
        return "No active config found"

    try:
        client = PathaoCourierClient(config)
        
        # Fetch cities
        cities_data = client.get_cities()
        if not cities_data:
            logger.warning("No cities found from Pathao API.")
            return "No cities found"

        with transaction.atomic():
            for city_item in cities_data:
                city_id = city_item.get("city_id")
                city_name = city_item.get("city_name")
                
                if not city_id or not city_name:
                    continue
                    
                city_obj, _ = PathaoCity.objects.update_or_create(
                    city_id=city_id,
                    defaults={"city_name": city_name}
                )
                
                # Fetch zones for this city
                try:
                    zones_data = client.get_zones(city_id)
                except Exception as e:
                    logger.error(f"Failed to fetch zones for city {city_id}: {e}")
                    continue
                    
                for zone_item in zones_data:
                    zone_id = zone_item.get("zone_id")
                    zone_name = zone_item.get("zone_name")
                    
                    if not zone_id or not zone_name:
                        continue
                        
                    zone_obj, _ = PathaoZone.objects.update_or_create(
                        zone_id=zone_id,
                        defaults={
                            "zone_name": zone_name,
                            "city": city_obj
                        }
                    )
                    
                    # Fetch areas for this zone
                    import time
                    time.sleep(0.5)
                    try:
                        areas_data = client.get_areas(zone_id)
                    except Exception as e:
                        if "Too Many Requests" in str(e):
                            logger.warning(f"Rate limited on zone {zone_id}. Sleeping for 5s.")
                            time.sleep(5)
                            try:
                                areas_data = client.get_areas(zone_id)
                            except Exception as inner_e:
                                logger.error(f"Failed again to fetch areas for zone {zone_id}: {inner_e}")
                                continue
                        else:
                            logger.error(f"Failed to fetch areas for zone {zone_id}: {e}")
                            continue
                        
                    for area_item in areas_data:
                        area_id = area_item.get("area_id")
                        area_name = area_item.get("area_name")
                        
                        if not area_id or not area_name:
                            continue
                            
                        PathaoArea.objects.update_or_create(
                            area_id=area_id,
                            defaults={
                                "area_name": area_name,
                                "zone": zone_obj
                            }
                        )
                        
        logger.info("Pathao locations synced successfully.")
        return "Pathao locations synced successfully"
    except Exception as e:
        logger.error(f"Error syncing Pathao locations: {e}")
        return f"Error: {e}"


@shared_task
def sync_cached_pathao_prices():
    """
    Auto syncs all cached Pathao price plan records from the Pathao API to keep database local pricing accurate.
    """
    from .models import PathaoZonePrice, PathaoCourierConfig
    from .views import PathaoCourierClient
    import time
    
    # Group by merchant/user config to use appropriate credentials
    configs = PathaoCourierConfig.objects.filter(is_active=True)
    if not configs.exists():
        return "No active courier configurations to sync prices."

    total_updated = 0
    
    for config in configs:
        client = PathaoCourierClient(config)
        # Find all local cache records associated with the current store ID
        cached_records = PathaoZonePrice.objects.filter(store_id=config.store_id)
        
        for record in cached_records:
            payload = {
                "store_id": int(record.store_id),
                "item_type": 2, # Parcel
                "delivery_type": 48, # Normal
                "item_weight": float(record.weight),
                "recipient_city": int(record.city_id),
                "recipient_zone": int(record.zone_id)
            }
            
            try:
                price_details = client.calculate_price(payload)
                record.delivery_fee = price_details.get("delivery_fee", record.delivery_fee)
                record.cod_charge = price_details.get("cod_charge", record.cod_charge)
                record.discount = price_details.get("discount", record.discount)
                record.total_amount = price_details.get("total_amount", record.total_amount)
                record.save()
                total_updated += 1
                time.sleep(0.5) # Prevent rate limiting
            except Exception as e:
                logger.error(f"Failed to sync cached price for store {record.store_id}, zone {record.zone_id}: {e}")
                
    return f"Successfully updated {total_updated} price caches."


# --- STEADFAST CELERY TASKS ---

@shared_task
def sync_steadfast_locations():
    """
    Syncs Cities and Areas from SteadFast API to local database.
    Requires at least one active SteadFastCourierConfig to get the API credentials.
    """
    from .models import SteadFastCourierConfig, SteadFastCity, SteadFastArea
    from .views import SteadFastCourierClient
    
    config = SteadFastCourierConfig.objects.filter(is_active=True).first()
    if not config:
        logger.warning("No active SteadFastCourierConfig found. Cannot sync SteadFast locations.")
        return "No active config found"

    try:
        client = SteadFastCourierClient(config)
        
        # Fetch cities
        cities_data = client.get_cities()
        if not cities_data:
            logger.warning("No cities found from SteadFast API.")
            return "No cities found"

        with transaction.atomic():
            for city_item in cities_data:
                city_id = city_item.get("city_id")
                city_name = city_item.get("city_name")
                
                if not city_id or not city_name:
                    continue
                    
                city_obj, _ = SteadFastCity.objects.update_or_create(
                    city_id=city_id,
                    defaults={"city_name": city_name}
                )
                
                # Fetch areas for this city
                try:
                    areas_data = client.get_areas(city_id)
                except Exception as e:
                    logger.error(f"Failed to fetch areas for city {city_id}: {e}")
                    continue
                    
                for area_item in areas_data:
                    area_id = area_item.get("area_id")
                    area_name = area_item.get("area_name")
                    
                    if not area_id or not area_name:
                        continue
                        
                    SteadFastArea.objects.update_or_create(
                        area_id=area_id,
                        defaults={
                            "area_name": area_name,
                            "city": city_obj
                        }
                    )
                
                # Rate limiting
                time.sleep(0.5)
                        
        logger.info("SteadFast locations synced successfully.")
        return "SteadFast locations synced successfully"
    except Exception as e:
        logger.error(f"Error syncing SteadFast locations: {e}")
        return f"Error: {e}"


@shared_task
def sync_cached_steadfast_prices():
    """
    Auto syncs all cached SteadFast price records from the SteadFast API to keep database local pricing accurate.
    """
    from .models import SteadFastAreaPrice, SteadFastCourierConfig
    from .views import SteadFastCourierClient
    
    configs = SteadFastCourierConfig.objects.filter(is_active=True)
    if not configs.exists():
        return "No active courier configurations to sync prices."

    total_updated = 0
    
    for config in configs:
        client = SteadFastCourierClient(config)
        # Find all local cache records
        cached_records = SteadFastAreaPrice.objects.all()
        
        for record in cached_records:
            payload = {
                "city_id": record.city_id,
                "area_id": record.area_id,
                "weight": float(record.weight)
            }
            
            try:
                price_details = client.calculate_price(payload)
                record.delivery_fee = price_details.get("delivery_charge", record.delivery_fee)
                record.cod_charge = price_details.get("cod_charge", record.cod_charge)
                record.total_amount = price_details.get("total_charge", record.total_amount)
                record.save()
                total_updated += 1
                time.sleep(0.5) # Prevent rate limiting
            except Exception as e:
                logger.error(f"Failed to sync cached price for area {record.area_id}, city {record.city_id}: {e}")
                
    return f"Successfully updated {total_updated} price caches."


@shared_task(bind=True, max_retries=1)
def scrape_courier_fraud_history_task(self, phone: str, merchant_id=None):
    """
    Background Playwright worker task that scrapes courier web portals (like Pathao)
    for delivery history of a given customer phone number, and persists the result
    into the central CourierRiskProfile database pool.
    """
    logger.info("[PlaywrightScrape] Starting scraper task for phone: %s (merchant_id=%s)", phone, merchant_id)
    from storefront.services.phone_history import normalize_phone_number, phone_fingerprint
    from storefront.models import CourierRiskProfile
    from django.utils import timezone
    from datetime import timedelta
    from courier.models import PathaoCourierConfig

    digits = normalize_phone_number(phone)
    if not digits or len(digits) < 10:
        logger.warning("[PlaywrightScrape] Invalid phone number provided: %s", phone)
        return "Invalid phone"

    fingerprint = phone_fingerprint(digits)

    # Find active Pathao credentials
    config = None
    if merchant_id:
        config = PathaoCourierConfig.objects.filter(user_id=merchant_id, is_active=True).first()
    if not config:
        config = PathaoCourierConfig.objects.filter(is_active=True).first()

    if not config or not config.username or not config.password:
        logger.info("[PlaywrightScrape] No Pathao merchant credentials found for scraping.")
        return "No credentials"

    try:
        from courier.scrapers.pathao_scraper import PathaoMerchantScraper
        scraper = PathaoMerchantScraper(username=config.username, password=config.password)
        logger.info("[PlaywrightScrape] Launching Playwright browser for Pathao with user: %s", config.username)
        data = scraper.scrape_phone(digits)
        logger.info("[PlaywrightScrape] Scraped result for %s: %s", digits[-4:], data)

        if data.get("total", 0) > 0 or data.get("delivered", 0) > 0 or data.get("returned", 0) > 0:
            now = timezone.now()
            # Save into global pool (merchant=None)
            profile, _ = CourierRiskProfile.objects.get_or_create(
                merchant=None,
                provider="pathao",
                phone_hash=fingerprint,
                defaults={"phone_last4": digits[-4:]},
            )
            profile.phone_last4 = digits[-4:]
            profile.total_parcels = data["total"]
            profile.delivered_count = data["delivered"]
            profile.returned_count = data["returned"]
            profile.cancelled_count = data.get("cancelled", 0)
            profile.success_rate = data.get("success_rate")
            profile.risk_level = data.get("risk_level", "unknown")
            profile.source_status = "scraped"
            profile.first_seen_at = profile.first_seen_at or now
            profile.last_synced_at = now
            profile.next_sync_at = now + timedelta(hours=6)
            profile.metadata = data.get("raw_data") or {}
            profile.save()

            logger.info(
                "[PlaywrightScrape] Successfully scraped and persisted Pathao profile for %s (Success: %s%%, Total: %s)",
                digits[-4:], profile.success_rate, profile.total_parcels,
            )
            return f"Success: {profile.total_parcels} parcels"
        else:
            logger.info("[PlaywrightScrape] No history found on Pathao portal for %s", digits[-4:])
            return "No history"

    except Exception as exc:
        logger.exception("[PlaywrightScrape] Scraper failed for %s", digits[-4:])
        return f"Error: {str(exc)}"


@shared_task(bind=True, max_retries=2)
def notify_customer_courier_update_task(self, order_id: int, event_name: str, status_label: str, reason: str = ""):
    """
    Sends localized, real-time order lifecycle notification to customer across all connected/linked
    platforms (Messenger, WhatsApp, Instagram, Telegram, and CustomerIdentities).
    """
    try:
        from users.models import CustomerOrder
        from storefront.services.checkout_link import get_shop_base_url
        from integrations.services.notification_dispatcher import CustomerNotificationDispatcher

        order = CustomerOrder.objects.select_related('user', 'customer', 'contact', 'contact__agent').filter(id=order_id).first()
        if not order:
            logger.info(f"[CourierNotify] Order #{order_id} not found.")
            return False

        shop_name = getattr(getattr(order.user, 'profile', None), 'shop_name', None) or order.user.name or "আমাদের শপ"
        tracking_url = f"{get_shop_base_url()}/orders/{order.public_id}"

        clean_event = (event_name or '').lower()
        msg_text = None

        if 'deliver' in clean_event and 'partial' not in clean_event and 'failed' not in clean_event:
            msg_text = (
                f"🎉 সুখবর {order.customer_name}!\n\n"
                f"আপনার অর্ডারটি সফলভাবে ডেলিভারি সম্পন্ন হয়েছে।\n"
                f"📦 অর্ডার নম্বর: #{order.id}\n"
                f"🛍️ পণ্য: {order.product_name}\n\n"
                f"{shop_name}-এর সাথে কেনাকাটা করার জন্য আপনাকে ধন্যবাদ! ❤️"
            )
        elif 'assigned_for_delivery' in clean_event or 'out_for_delivery' in clean_event:
            msg_text = (
                f"🛵 আসসালামু আলাইকুম {order.customer_name}!\n\n"
                f"আমাদের ডেলিভারি রাইডার আজ আপনার পার্সেলটি নিয়ে বের হয়েছে। কিছুক্ষণের মধ্যে আপনার ঠিকানায় পৌঁছাবে।\n\n"
                f"📦 অর্ডার নম্বর: #{order.id}\n"
                f"💰 প্রদেয় বিল: ৳{order.price + (order.delivery_charge or 0)}\n"
                f"📍 ঠিকানা: {order.address}\n\n"
                f"অনুগ্রহ করে আপনার ফোনটি সচল রাখুন।\n"
                f"🚚 লাইভ ট্র্যাকিং: {tracking_url}"
            )
        elif 'picked' in clean_event or 'in-transit' in clean_event or 'in_transit' in clean_event or 'shipped' in clean_event:
            msg_text = (
                f"🚚 প্রিয় {order.customer_name},\n\n"
                f"আপনার অর্ডারটি (#{order.id}) কুরিয়ারে হস্তান্তর করা হয়েছে এবং আপনার ঠিকানার উদ্দেশ্যে রওনা হয়েছে।\n\n"
                f"📦 স্ট্যাটাস: {status_label}\n"
                f"🚚 লাইভ ট্র্যাক করতে ট্যাপ করুন:\n{tracking_url}"
            )
        elif 'fail' in clean_event or 'hold' in clean_event:
            reason_str = f"\nকারণ: {reason}" if reason else ""
            msg_text = (
                f"⚠️ আসসালামু আলাইকুম {order.customer_name},\n\n"
                f"আপনার অর্ডারটির (#{order.id}) ডেলিভারি সাময়িকভাবে বিলম্বিত হয়েছে।{reason_str}\n\n"
                f"আমাদের প্রতিনিধি বা রাইডার পুনরায় আপনার সাথে যোগাযোগ করবেন। যেকোনো প্রয়োজনে আমাদের ইনবক্সে জানান।"
            )
        elif 'return' in clean_event or 'cancel' in clean_event:
            msg_text = (
                f"📦 প্রিয় {order.customer_name},\n\n"
                f"আপনার অর্ডারটি (#{order.id}) {status_label} হয়েছে।\n"
                f"যেকোনো তথ্যের জন্য আমাদের পেজে মেসেজ করুন।"
            )

        if not msg_text:
            return False

        dispatch_res = CustomerNotificationDispatcher.dispatch_message(
            order=order,
            message_text=msg_text,
            event_tag=f"courier:{clean_event}"
        )
        return dispatch_res.get('sent_count', 0) > 0

    except Exception as exc:
        logger.warning(f"⚠️ [CourierNotify] Failed sending customer update for Order #{order_id}: {exc}")
    return False



@shared_task(name="courier.tasks.sync_pending_steadfast_parcels_task")
def sync_pending_steadfast_parcels_task():
    """
    Periodic self-healing task to sync pending/in-review Steadfast parcels.
    If a parcel was removed or canceled directly on the Steadfast merchant portal,
    it detects status 'unknown' and safely resets the booking on the order.
    """
    from users.models import CustomerOrder
    from courier.models import SteadfastCourierConfig
    from courier.provider_registry import CourierProviderRegistry
    from courier.reset_views import reset_order_courier_booking

    logger.info("🔄 [CourierSync] Starting sync_pending_steadfast_parcels_task...")
    pending_orders = CustomerOrder.objects.filter(
        courier_name="steadfast",
        courier_consignment_id__isnull=False
    ).exclude(
        courier_delivery_status__in=["delivered", "cancelled", "returned", "partial_delivered"]
    )[:50]

    synced_count = 0
    reset_count = 0

    for order in pending_orders:
        try:
            profile = getattr(order.user, 'profile', None)
            if not profile:
                continue
            config = SteadfastCourierConfig.objects.filter(profile=profile, is_active=True).first()
            if not config or not config.api_key or not config.secret_key:
                continue

            provider = CourierProviderRegistry.get_provider("steadfast")
            if not provider:
                continue

            status_res = provider.get_delivery_status(config=config, consignment_id=order.courier_consignment_id)
            delivery_status = status_res.get("delivery_status", "").lower()

            if delivery_status == "unknown" or status_res.get("status") == 404:
                # Parcel was deleted/unlinked on Steadfast portal -> auto reset booking
                reset_order_courier_booking(order, reason="Auto-reset: Deleted from Steadfast portal")
                reset_count += 1
                logger.info(f"🔄 [CourierSync] Auto-reset Order #{order.id} (Consignment {order.courier_consignment_id} deleted on Steadfast)")
            elif delivery_status and delivery_status != order.courier_delivery_status:
                order.courier_delivery_status = delivery_status
                order.save(update_fields=["courier_delivery_status", "updated_at"])
                synced_count += 1
        except Exception as exc:
            logger.warning(f"⚠️ [CourierSync] Failed checking Steadfast order #{order.id}: {exc}")

    logger.info(f"✅ [CourierSync] Done. Synced: {synced_count}, Auto-reset: {reset_count}")
    return {"synced": synced_count, "reset": reset_count}
