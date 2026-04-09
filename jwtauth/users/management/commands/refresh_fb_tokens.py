from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from users.models import FacebookPage
from webhooks.tasks import refresh_fb_page_token


class Command(BaseCommand):
    help = "Refresh expiring Facebook Page access tokens using stored long-lived user tokens"

    def add_arguments(self, parser):
        parser.add_argument(
            '--days', type=int, default=5,
            help='Refresh tokens expiring within N days (default: 5)'
        )

    def handle(self, *args, **options):
        days = options['days']
        cutoff = timezone.now() + timedelta(days=days)

        pages = FacebookPage.objects.filter(is_active=True, token_expires_at__lte=cutoff)
        total = pages.count()
        refreshed = 0

        for fb_page in pages:
            new_token = refresh_fb_page_token(fb_page)
            if new_token:
                refreshed += 1

        self.stdout.write(self.style.SUCCESS(
            f"Checked {total} page(s); refreshed {refreshed} token(s) expiring within {days} day(s)."
        ))
