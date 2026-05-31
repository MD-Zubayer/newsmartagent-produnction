import time
import random
from django.core.management.base import BaseCommand
from django.db import transaction
from courier.models import SteadFastCourierConfig, SteadFastCity, SteadFastArea
from courier.views import SteadFastCourierClient


class Command(BaseCommand):
    help = "Syncs SteadFast cities and areas into the local courier database."

    def safe_request(self, func, *args, **kwargs):
        retries = 3
        base_delay = 8

        for attempt in range(retries):
            try:
                time.sleep(random.uniform(1.0, 2.5))
                return func(*args, **kwargs)
            except Exception as e:
                err = str(e)
                if "Too Many Requests" in err or "429" in err:
                    wait_seconds = base_delay * (2 ** attempt) + random.uniform(2, 8)
                    self.stdout.write(self.style.WARNING(
                        f"  Rate limited by SteadFast. Waiting {wait_seconds:.1f}s before retry {attempt + 1}/{retries}..."
                    ))
                    time.sleep(wait_seconds)
                    continue
                raise
        return None

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("--- Starting Smart SteadFast Sync ---"))

        config = SteadFastCourierConfig.objects.filter(is_active=True).first()
        if not config:
            self.stdout.write(self.style.ERROR("Error: No active SteadFast Configuration found in database."))
            return

        client = SteadFastCourierClient(config)

        try:
            self.stdout.write(self.style.NOTICE("Fetching SteadFast cities..."))
            cities_data = self.safe_request(client.get_cities)
            if not cities_data:
                self.stdout.write(self.style.ERROR("Could not retrieve cities from SteadFast. Exiting."))
                return

            total_cities = len(cities_data)
            self.stdout.write(self.style.SUCCESS(f"Found {total_cities} cities from SteadFast."))

            for idx, city_item in enumerate(cities_data, start=1):
                # SteadFast may return districts inside the top-level list where each
                # district object contains a nested `policestations` list under `data`.
                # Support multiple possible key names for robustness.
                city_id = city_item.get("city_id") or city_item.get("district_id") or city_item.get("id")
                city_name = city_item.get("city_name") or city_item.get("district_name") or city_item.get("name")

                if not city_id or not city_name:
                    self.stdout.write(self.style.WARNING(f"Skipping invalid district/city record at index {idx}."))
                    continue

                city_obj, created = SteadFastCity.objects.update_or_create(
                    city_id=city_id,
                    defaults={"city_name": city_name}
                )

                self.stdout.write(self.style.NOTICE(
                    f"[{idx}/{total_cities}] District: {city_name} (ID: {city_id}) {'created' if created else 'updated'}"
                ))

                # First, try to read nested policestations in the response payload
                policestations = None
                # Some responses put the list under 'policestations' key
                if isinstance(city_item.get('policestations'), list):
                    policestations = city_item.get('policestations')
                # Some responses nest them under a 'data' key inside the district
                elif isinstance(city_item.get('data'), list):
                    # data may be a list of policestations or a list of district children
                    # if items in data have 'policestations', flatten them
                    data_list = city_item.get('data', [])
                    # If data_list items themselves have policestations, extract them
                    if data_list and isinstance(data_list[0], dict) and 'policestations' in data_list[0]:
                        flattened = []
                        for d in data_list:
                            if isinstance(d.get('policestations'), list):
                                flattened.extend(d.get('policestations'))
                        policestations = flattened
                    else:
                        # If data_list looks like direct area objects, use it
                        policestations = data_list

                # If we didn't find nested policestations, fall back to the legacy API call
                if not policestations:
                    areas_data = self.safe_request(client.get_areas, city_id)
                else:
                    areas_data = policestations

                if not areas_data:
                    self.stdout.write(self.style.WARNING(f"  No areas/policestations returned for district {city_name}."))
                    continue

                with transaction.atomic():
                    synced_count = 0
                    for area_item in areas_data:
                        # Support multiple possible area id/name keys from SteadFast
                        area_id = area_item.get('area_id') or area_item.get('id') or area_item.get('police_station_id')
                        area_name = area_item.get('area_name') or area_item.get('name') or area_item.get('police_station_name')
                        if not area_id or not area_name:
                            continue

                        SteadFastArea.objects.update_or_create(
                            area_id=area_id,
                            defaults={
                                "area_name": area_name,
                                "city": city_obj
                            }
                        )
                        synced_count += 1

                self.stdout.write(self.style.SUCCESS(
                    f"  Synced {synced_count} areas/thanas for district {city_name}"
                ))

            self.stdout.write(self.style.SUCCESS("SteadFast location sync completed successfully!"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"[CRITICAL ERROR] {type(e).__name__}: {e}"))
