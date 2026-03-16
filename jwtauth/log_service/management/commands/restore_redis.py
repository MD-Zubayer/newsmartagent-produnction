import os
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from log_service.google_drive import get_latest_file_in_folder, download_file_from_drive, get_or_create_folder

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Google Drive থেকে লেটেস্ট Redis ব্যাকআপ ফাইল নামিয়ে রিস্টোর করার ইনস্ট্রাকশন দেয়।'

    def handle(self, *args, **options):
        self.stdout.write('Starting Redis backup retrieval from Google Drive...')

        root_folder_id = getattr(settings, 'GOOGLE_DRIVE_LOG_FOLDER_ID', None)
        if not root_folder_id:
            self.stdout.write(self.style.ERROR('GOOGLE_DRIVE_LOG_FOLDER_ID settings-এ নেই।'))
            return

        try:
            # ১. ব্যাকআপ ফোল্ডার আইডি খুঁজে বের করা
            sub_folder_id = get_or_create_folder('redis-backups', parent_folder_id=root_folder_id)
            
            # ২. লেটেস্ট ফাইলটি খুঁজে বের করা
            latest_file = get_latest_file_in_folder(sub_folder_id, pattern='redis_backup_')
            if not latest_file:
                self.stdout.write(self.style.WARNING('ড্রাইভে কোনো Redis ব্যাকআপ ফাইল পাওয়া যায়নি।'))
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

            self.stdout.write(self.style.SUCCESS(f"✅ Download complete: {local_path}"))
            
            # ৪. রিস্টোর ইনস্ট্রাকশন দেওয়া
            self.stdout.write("\n" + "="*50)
            self.stdout.write(self.style.HTTP_INFO("Redis রিস্টোর সম্পন্ন করতে আপনার VPS টার্মিনালে নিচের কমান্ডগুলো দিন:"))
            self.stdout.write("="*50)
            
            # আরডিবি ফাইলটি রেডিস কন্টেইনারে মুভ করা এবং রিস্টার্ট করা
            self.stdout.write(f"\n1. কন্টেইনারে ফাইলটি মুভ করুন:")
            self.stdout.write(self.style.SUCCESS(f"docker cp {local_path} newsmartagent-redis:/data/dump.rdb"))
            
            self.stdout.write(f"\n2. Redis কন্টেইনার রিস্টার্ট করুন:")
            self.stdout.write(self.style.SUCCESS("docker restart newsmartagent-redis"))
            
            self.stdout.write("\n" + "="*50)

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"ত্রুটি: {str(e)}"))
            logger.error(f"Redis restore command error: {e}", exc_info=True)
