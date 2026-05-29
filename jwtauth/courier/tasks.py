import logging
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
