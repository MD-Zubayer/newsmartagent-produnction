"""
Celery Tasks — Google Drive Log Sync
=====================================
Periodic task: প্রতি N মিনিটে log file গুলো Google Drive-এ sync করে।
"""

import os
import logging
import subprocess
import datetime
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, name='log_service.sync_logs_to_drive')
def sync_logs_to_drive(self):
    """
    Django এবং Celery log file গুলো Google Drive-এ sync করে।
    Celery Beat দিয়ে periodic চলবে।
    """
    # Lazy import যাতে Drive service শুধু প্রয়োজনে load হয়
    from log_service.google_drive import get_or_create_folder, upload_or_update_file

    root_folder_id = getattr(settings, 'GOOGLE_DRIVE_LOG_FOLDER_ID', None)
    if not root_folder_id:
        logger.warning("GOOGLE_DRIVE_LOG_FOLDER_ID settings-এ নেই। Log sync বন্ধ।")
        return {'status': 'skipped', 'reason': 'no folder id'}

    log_dir = getattr(settings, 'LOG_DIR', os.path.join(settings.BASE_DIR, 'logs'))

    # কোন কোন file sync করবে
    log_files = {
        'ai_agent.log': os.path.join(log_dir, 'ai_agent.log'),
        'celery_worker.log': os.path.join(log_dir, 'celery_worker.log'),
    }

    # Sub-folder তৈরি: "newsmartagent-logs"
    try:
        sub_folder_id = get_or_create_folder(
            folder_name=getattr(settings, 'GOOGLE_DRIVE_LOG_SUBFOLDER', 'newsmartagent-logs'),
            parent_folder_id=root_folder_id
        )
    except Exception as e:
        logger.error(f"Drive folder তৈরি করতে সমস্যা: {e}", exc_info=True)
        return {'status': 'error', 'reason': str(e)}

    synced = []
    errors = []

    for drive_name, local_path in log_files.items():
        if not os.path.exists(local_path):
            logger.debug(f"File নেই, skip: {local_path}")
            continue
        try:
            file_id = upload_or_update_file(
                local_file_path=local_path,
                drive_file_name=drive_name,
                folder_id=sub_folder_id
            )
            synced.append({'file': drive_name, 'drive_id': file_id})
            logger.info(f"✅ Drive sync সফল: {drive_name}")
        except Exception as e:
            errors.append({'file': drive_name, 'error': str(e)})
            logger.error(f"❌ Drive sync ব্যর্থ: {drive_name} — {e}", exc_info=True)

    return {
        'status': 'done',
        'synced': synced,
        'errors': errors
    }


@shared_task(name='log_service.backup_db_to_drive')
def backup_db_to_drive():
    from log_service.google_drive import get_or_create_folder, upload_or_update_file

    db_url = os.environ.get('DATABASE_URL', '')
    
    # 🔥 পরিবর্তন ১: ফাইলের নাম ফিক্সড করে দিন (কোনো টাইমস্ট্যাম্প ছাড়া)
    backup_filename = "db_backup_latest.sql.gz" 
    
    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    local_backup_path = os.path.join(backup_dir, backup_filename)

    try:
        # pg_dump command
        cmd = f"pg_dump {db_url} | gzip > {local_backup_path}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if result.returncode != 0:
            return {'status': 'error', 'reason': f"pg_dump failed: {result.stderr}"}

        root_folder_id = getattr(settings, 'GOOGLE_DRIVE_LOG_FOLDER_ID', None)
        
        # Sub-folder: "database-backups"
        folder_id = get_or_create_folder(
            folder_name='database-backups',
            parent_folder_id=root_folder_id
        )

        # 🔥 পরিবর্তন ২: আপলোড করার সময় এটি ড্রাইভের বিদ্যমান ফাইলকে ওভাররাইট করবে
        file_id = upload_or_update_file(
            local_file_path=local_backup_path,
            drive_file_name=backup_filename, # সবসময় একই নামে আপলোড হবে
            folder_id=folder_id
        )

        if os.path.exists(local_backup_path):
            os.remove(local_backup_path)

        logger.info(f"✅ Database backup successful: {backup_filename}")
        return {'status': 'done', 'file_id': file_id}

    except Exception as e:
        logger.error(f"Database backup error: {e}", exc_info=True)
        return {'status': 'error', 'reason': str(e)}


@shared_task(name='log_service.backup_redis_to_drive')
def backup_redis_to_drive():
    """
    Redis RDB snapshot তৈরি করে Google Drive-এ আপলোড করে।
    """
    from log_service.google_drive import get_or_create_folder, upload_or_update_file

    # Redis configuration
    redis_url = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
    # Extract host from redis://redis:6379/0
    try:
        redis_host = redis_url.split('//')[1].split(':')[0]
    except:
        redis_host = 'newsmartagent-redis'

    backup_filename = "redis_backup_latest.rdb"
    backup_dir = os.path.join(settings.BASE_DIR, 'backups')
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
    
    local_backup_path = os.path.join(backup_dir, backup_filename)

    try:
        # Use redis-cli to create an RDB snapshot directly to our local path
        cmd = f"redis-cli -h {redis_host} --rdb {local_backup_path}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

        if result.returncode != 0:
            logger.error(f"Redis backup failed: {result.stderr}")
            return {'status': 'error', 'reason': f"Redis CLI failed: {result.stderr}"}

        # Google Drive Integration
        root_folder_id = getattr(settings, 'GOOGLE_DRIVE_LOG_FOLDER_ID', None)
        
        # Sub-folder: "redis-backups"
        folder_id = get_or_create_folder(
            folder_name='redis-backups',
            parent_folder_id=root_folder_id
        )

        # Upload to Drive
        file_id = upload_or_update_file(
            local_file_path=local_backup_path,
            drive_file_name=backup_filename,
            folder_id=folder_id
        )

        if os.path.exists(local_backup_path):
            os.remove(local_backup_path)

        logger.info(f"✅ Redis backup successful: {backup_filename}")
        return {'status': 'done', 'file_id': file_id}

    except Exception as e:
        logger.error(f"Redis backup error: {e}", exc_info=True)
        return {'status': 'error', 'reason': str(e)}