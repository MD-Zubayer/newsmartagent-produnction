from django.core.management.base import BaseCommand
from log_service.tasks import sync_logs_to_drive

class Command(BaseCommand):
    help = 'Syncs ai_agent and celery_worker logs to Google Drive immediately.'

    def handle(self, *args, **options):
        self.stdout.write('Starting log sync to Google Drive...')
        
        # log_service/tasks.py-তে যে ফাংশনটি আছে সেটিই কল করা হচ্ছে
        result = sync_logs_to_drive()
        
        if result.get('status') == 'done':
            self.stdout.write(self.style.SUCCESS("Log sync operation finished."))
            
            synced_files = result.get('synced', [])
            error_files = result.get('errors', [])
            
            for uploaded in synced_files:
                self.stdout.write(self.style.SUCCESS(f" ✅ Uploaded: {uploaded['file']} (ID: {uploaded['drive_id']})"))
                
            for error in error_files:
                self.stdout.write(self.style.ERROR(f" ❌ Failed {error['file']}: {error['error']}"))
                
            if not synced_files and not error_files:
                self.stdout.write("No files were uploaded or updated.")
                
        else:
            self.stdout.write(self.style.ERROR(f"Sync skipped or failed entirely: {result.get('reason')}"))
