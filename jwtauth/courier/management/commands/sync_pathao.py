import time
import random
from django.core.management.base import BaseCommand
from django.db import transaction
from courier.models import PathaoCourierConfig, PathaoCity, PathaoZone, PathaoArea, PathaoZonePrice
from courier.views import PathaoCourierClient

class Command(BaseCommand):
    help = "Smartly syncs Pathao locations by skipping existing data and handling rate limits."

    def safe_request(self, func, *args, **kwargs):
        """
        Helper function to handle Pathao's strict rate limiting with retries.
        """
        retries = 3
        base_delay = 10  # ৫ সেকেন্ডের জায়গায় ১০ সেকেন্ড দিয়ে শুরু করা নিরাপদ

        for i in range(retries):
            try:
                # রিকোয়েস্টের আগে হিউম্যান-লাইক র‍্যান্ডম ওয়েট
                time.sleep(random.uniform(1.0, 2.5))
                return func(*args, **kwargs)
            except Exception as e:
                err_str = str(e)
                if "Too Many Requests" in err_str or "429" in err_str:
                    wait_time = base_delay * (2 ** i) + random.uniform(2, 20)
                    self.stdout.write(self.style.WARNING(
                        f"  Rate limit hit! Waiting {wait_time:.1f}s before retry {i+1}/{retries}..."
                    ))
                    time.sleep(wait_time)
                else:
                    raise e
        return None

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("--- Starting Smart Pathao Sync ---"))
        
        # ১. একটিভ কনফিগারেশন চেক
        config = PathaoCourierConfig.objects.filter(is_active=True).first()
        if not config:
            self.stdout.write(self.style.ERROR("Error: No active Pathao Configuration found in database."))
            return

        client = PathaoCourierClient(config)
        
        try:
            # ২. টোকেন সংগ্রহ (এটি অটোমেটিক সেভ হবে আপনার Client ক্লাসের লজিক অনুযায়ী)
            self.stdout.write(self.style.NOTICE("Authenticating..."))
            client.get_access_token()
            
            # ৩. সিটি বা জেলা সংগ্রহ
            cities_data = self.safe_request(client.get_cities)
            if not cities_data:
                self.stdout.write(self.style.ERROR("Could not retrieve cities. Exiting."))
                return

            total_cities = len(cities_data)
            self.stdout.write(self.style.SUCCESS(f"Found {total_cities} cities."))

            for idx, city_item in enumerate(cities_data, 1):
                city_id = city_item.get("city_id")
                city_name = city_item.get("city_name")

                # সিটি ডাটাবেসে সেভ বা আপডেট করুন
                city_obj, city_created = PathaoCity.objects.update_or_create(
                    city_id=city_id, defaults={"city_name": city_name}
                )

                # স্মার্ট চেক: এই সিটির জোন এবং সব জোনের এরিয়া অলরেডি আছে কি না?
                existing_zones = PathaoZone.objects.filter(city=city_obj)
                existing_zones_count = existing_zones.count()
                
                has_zones_without_areas = False
                if existing_zones_count > 0:
                    # কোনো জোনের এরিয়া না থাকলে আমরা সিটি স্কিপ করব না, যাতে ওই এরিয়াগুলো ফেচ হতে পারে
                    has_zones_without_areas = existing_zones.filter(areas__isnull=True).exists()

                if not city_created and existing_zones_count > 0 and not has_zones_without_areas:
                    self.stdout.write(self.style.SUCCESS(f"[{idx}/{total_cities}] Skipping City: {city_name} (Already Synced)"))
                    continue
                
                self.stdout.write(self.style.NOTICE(f"[{idx}/{total_cities}] Fetching Zones and Areas for: {city_name}"))
                
                # ৪. জোন সংগ্রহ
                zones_data = self.safe_request(client.get_zones, city_id)
                if not zones_data:
                    continue
                
                for zone_item in zones_data:
                    zone_id = zone_item.get("zone_id")
                    zone_name = zone_item.get("zone_name")

                    zone_obj, zone_created = PathaoZone.objects.update_or_create(
                        zone_id=zone_id, 
                        defaults={"zone_name": zone_name, "city": city_obj}
                    )

                    # স্মার্ট চেক: এই জোনের এরিয়া অলরেডি আছে কি না?
                    existing_areas_count = PathaoArea.objects.filter(zone=zone_obj).count()
                    
                    if not zone_created and existing_areas_count > 0:
                        # জোন থাকলেও এরিয়া না থাকলে শুধু এরিয়া ফেচ করবে
                        continue

                    # ৫. এরিয়া সংগ্রহ (সবচেয়ে সেনসিটিভ পার্ট)
                    areas_data = self.safe_request(client.get_areas, zone_id)
                    
                    if areas_data:
                        with transaction.atomic():
                            for area_item in areas_data:
                                PathaoArea.objects.update_or_create(
                                    area_id=area_item.get("area_id"),
                                    defaults={
                                        "area_name": area_item.get("area_name"),
                                        "zone": zone_obj
                                    }
                                )
                        self.stdout.write(f"    - Synced {len(areas_data)} areas for {zone_name}")

            # ৬. ডেলিভারি প্রাইস রেট সিঙ্ক (ডাটাবেসে থাকা সব জোনের জন্য)
            self.stdout.write(self.style.NOTICE("\n--- Syncing Delivery Prices for All Zones ---"))
            all_zones = PathaoZone.objects.select_related('city').all()
            total_zones = all_zones.count()
            self.stdout.write(self.style.SUCCESS(f"Found {total_zones} zones in local database to sync prices."))
            
            for p_idx, zone in enumerate(all_zones, 1):
                payload = {
                    "store_id": int(config.store_id),
                    "item_type": 2, # Parcel
                    "delivery_type": 48, # Normal
                    "item_weight": 0.5, # Default standard weight
                    "recipient_city": int(zone.city.city_id),
                    "recipient_zone": int(zone.zone_id)
                }
                
                try:
                    price_details = self.safe_request(client.calculate_price, payload)
                    if price_details:
                        PathaoZonePrice.objects.update_or_create(
                            store_id=str(config.store_id),
                            city_id=int(zone.city.city_id),
                            zone_id=int(zone.zone_id),
                            weight=0.5,
                            defaults={
                                "delivery_fee": price_details.get("delivery_fee", 0.0),
                                "cod_charge": price_details.get("cod_charge", 0.0),
                                "discount": price_details.get("discount", 0.0),
                                "total_amount": price_details.get("total_amount", 0.0)
                            }
                        )
                        self.stdout.write(self.style.SUCCESS(
                            f"  [{p_idx}/{total_zones}] Synced/Saved Price for Zone {zone.zone_name} (ID: {zone.zone_id}): {price_details.get('total_amount')} BDT"
                        ))
                except Exception as pe:
                    self.stdout.write(self.style.WARNING(
                        f"  [{p_idx}/{total_zones}] Failed to sync price for Zone {zone.zone_name} (ID: {zone.zone_id}): {str(pe)}"
                    ))

            self.stdout.write(self.style.SUCCESS("\nSmart Synchronization completed successfully!"))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n[CRITICAL ERROR]: {str(e)}"))
            
            
            
            
            
            
 