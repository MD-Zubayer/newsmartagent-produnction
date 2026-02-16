from django.core.management.base import BaseCommand
from users.models import UniqueIDPool



class Command(BaseCommand):
    help = 'Pre-generate 10-digit unique IDs'

    def handle(self, *args, **options):
        start = 1000000000
        end = 1009999999
        bulk = []
        for i in range(start, end):
            bulk.append(UniqueIDPool(uid=str(i)))
        UniqueIDPool.objects.bulk_create(bulk, batch_size=5000, ignore_conflicts=True)
        self.stdout.write(self.style.SUCCESS('IDs generated successfully'))
        
       


