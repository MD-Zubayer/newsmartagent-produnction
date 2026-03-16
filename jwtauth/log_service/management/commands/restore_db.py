import os
import subprocess
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from log_service.google_drive import get_latest_file_in_folder, download_file_from_drive, get_or_create_folder

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Google Drive থেকে লেটেস্ট ব্যাকআপ ফাইল নামিয়ে অটোমেটিক ডেটাবেস রিস্টোর করে।'

    def handle(self, *args, **options):
        self.stdout.write('Starting automatic database restore from Google Drive...')

        root_folder_id = getattr(settings, 'GOOGLE_DRIVE_LOG_FOLDER_ID', None)
        if not root_folder_id:
            self.stdout.write(self.style.ERROR('GOOGLE_DRIVE_LOG_FOLDER_ID settings-এ নেই।'))
            return

        try:
            # ১. ব্যাকআপ ফোল্ডার আইডি খুঁজে বের করা
            sub_folder_id = get_or_create_folder('database-backups', parent_folder_id=root_folder_id)
            
            # ২. লেটেস্ট ফাইলটি খুঁজে বের করা
            latest_file = get_latest_file_in_folder(sub_folder_id, pattern='db_backup_')
            if not latest_file:
                self.stdout.write(self.style.WARNING('ড্রাইভে কোনো ব্যাকআপ ফাইল পাওয়া যায়নি।'))
                return

            file_id = latest_file['id']
            file_name = latest_file['name']
            self.stdout.write(f"Found latest backup: {file_name} (ID: {file_id})")

            # ৩. ফাইল ডাউনলোড করা
            temp_dir = os.path.join(settings.BASE_DIR, 'temp_restore')
            if not os.path.exists(temp_dir):
                os.makedirs(temp_dir)
            
            local_path = os.path.join(temp_dir, file_name)
            self.stdout.write(f"Downloading to {local_path}...")
            download_file_from_drive(file_id, local_path)

            # ৪. ডেটাবেস রিস্টোর করা
            db_url = os.environ.get('DATABASE_URL')
            if not db_url:
                self.stdout.write(self.style.ERROR('DATABASE_URL পাওয়া যায়নি।'))
                return

            self.stdout.write("Restoring database (this may take a while)...")
            
            # ফাইলের এক্সটেনশন অনুযায়ী কমান্ড ঠিক করা
            if file_name.endswith('.gz'):
                restore_cmd = f"gunzip -c {local_path} | psql {db_url}"
            else:
                restore_cmd = f"psql {db_url} < {local_path}"

            result = subprocess.run(restore_cmd, shell=True, capture_output=True, text=True)

            if result.returncode == 0:
                self.stdout.write(self.style.SUCCESS(f"✅ Successfully restored database from {file_name}"))
            else:
                self.stdout.write(self.style.ERROR(f"❌ Restore failed: {result.stderr}"))

            # ৫. টেম্পোরারি ফাইল মুছে ফেলা
            if os.path.exists(local_path):
                os.remove(local_path)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"অপ্রত্যাশিত ত্রুটি: {str(e)}"))
            logger.error(f"Restore command error: {e}", exc_info=True)
