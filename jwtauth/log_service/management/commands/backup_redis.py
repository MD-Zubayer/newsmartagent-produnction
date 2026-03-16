from django.core.management.base import BaseCommand
from log_service.tasks import backup_redis_to_drive

class Command(BaseCommand):
    help = 'Backs up Redis data to Google Drive immediately.'

    def handle(self, *args, **options):
        self.stdout.write('Starting Redis backup to Google Drive...')
        result = backup_redis_to_drive()
        if result.get('status') == 'done':
            self.stdout.write(self.style.SUCCESS(f"Successfully backed up Redis. File ID: {result.get('file_id')}"))
        else:
            self.stdout.write(self.style.ERROR(f"Backup failed: {result.get('reason')}"))
