"""
Celery Tasks — Google Drive Log Sync
=====================================
Periodic task: প্রতি N মিনিটে log file গুলো Google Drive-এ sync করে।
"""

import os
import logging
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
