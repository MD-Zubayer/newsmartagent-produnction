from django.core.management.base import BaseCommand
from courier.utils.redis_courier_cache import populate_courier_redis_cache

class Command(BaseCommand):
    help = 'Populates the Redis courier city/zone/area autocomplete index'

    def handle(self, *args, **options):
        self.stdout.write("Populating Redis courier cache...")
        success = populate_courier_redis_cache()
        if success:
            self.stdout.write(self.style.SUCCESS("Successfully populated Redis courier cache!"))
        else:
            self.stdout.write(self.style.ERROR("Failed to populate Redis courier cache."))
