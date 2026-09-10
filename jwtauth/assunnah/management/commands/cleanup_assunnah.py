from django.core.management.base import BaseCommand
from django.utils import timezone

from assunnah.models import Collection


class Command(BaseCommand):
    help = "Delete expired As-Sunnah temporary collections"

    def handle(self, *args, **options):
        deleted, _ = Collection.objects.filter(expires_at__lte=timezone.now()).delete()
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} expired As-Sunnah records."))

