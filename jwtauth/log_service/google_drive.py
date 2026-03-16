"""
Google Drive API Wrapper
========================
Google Drive-এ log file upload এবং update করার জন্য।
Service Account ব্যবহার করা হচ্ছে (server-to-server auth)।
"""

import os
import io
import logging
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from googleapiclient.errors import HttpError
from django.conf import settings
from googleapiclient.http import MediaFileUpload
logger = logging.getLogger(__name__)

# Google Drive API scope
SCOPES = ['https://www.googleapis.com/auth/drive']


def _get_drive_service():
    """
    Service account credentials দিয়ে Google Drive API service তৈরি করে।
    """
    service_account_file = getattr(settings, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE', None)
    service_account_info = getattr(settings, 'GOOGLE_DRIVE_SERVICE_ACCOUNT_INFO', None)

    if service_account_info:
        # dict থেকে credentials (env variable থেকে লোড করা JSON)
        credentials = service_account.Credentials.from_service_account_info(
            service_account_info, scopes=SCOPES
        )
    elif service_account_file and os.path.exists(service_account_file):
        # JSON file থেকে credentials
        credentials = service_account.Credentials.from_service_account_file(
            service_account_file, scopes=SCOPES
        )
    else:
        raise ValueError(
            "Google Drive credentials পাওয়া যায়নি। "
            "GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE অথবা GOOGLE_DRIVE_SERVICE_ACCOUNT_INFO "
            "settings-এ set করুন।"
        )

    service = build('drive', 'v3', credentials=credentials)
    return service


def get_or_create_folder(folder_name: str, parent_folder_id: str = None) -> str:
    """
    Google Drive-এ folder খুঁজে বের করে, না থাকলে তৈরি করে।
    folder_id return করে।
    """
    service = _get_drive_service()

    query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    if parent_folder_id:
        query += f" and '{parent_folder_id}' in parents"

    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)'
    ).execute()

    folders = results.get('files', [])
    if folders:
        return folders[0]['id']

    # folder নেই, তৈরি করো
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_folder_id:
        file_metadata['parents'] = [parent_folder_id]

    folder = service.files().create(body=file_metadata, fields='id').execute()
    logger.info(f"Google Drive-এ folder তৈরি হয়েছে: {folder_name} (id={folder['id']})")
    return folder['id']


def upload_or_update_file(local_file_path: str, drive_file_name: str, folder_id: str) -> str:
    """
    local_file_path থেকে পড়ে Google Drive-এ upload বা update করে।
    Ownership Transfer লজিক সহ যাতে Quota Error না আসে।
    """
    service = _get_drive_service()

    # Drive-এ একই নামের file আছে কিনা চেক করো
    query = f"name='{drive_file_name}' and '{folder_id}' in parents and trashed=false"
    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)'
    ).execute()

    files = results.get('files', [])

    try:
        with open(local_file_path, 'rb') as f:
            content = f.read()
    except FileNotFoundError:
        logger.warning(f"Log file পাওয়া যায়নি: {local_file_path}")
        return None

    media = MediaFileUpload(
        local_file_path,
        mimetype='text/plain',
        resumable=True # বড় ফাইলের জন্য এটি অনেক বেশি স্টেবল
    )

    if files:
        file_id = files[0]['id']
        service.files().update(
            fileId=file_id,
            media_body=media,
            supportsAllDrives=True
        ).execute()
        logger.debug(f"Drive file updated: {drive_file_name} (id={file_id})")
    else:
        # Create new file
        file_metadata = {
            'name': drive_file_name,
            'parents': [folder_id]
        }
        
        # ফাইল তৈরি করার সময় supportsAllDrives ব্যবহার করুন
        created = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id',
            supportsAllDrives=True 
        ).execute()
        file_id = created['id']
        
        # 🔥 নতুন ফাইল তৈরির পর Ownership Transfer করুন আপনার মেইন ইমেইলে
        try:
            user_email = "newsmartagentbd@gmail.com" # আপনার মেইন ইমেইল
            service.permissions().create(
                fileId=file_id,
                body={
                    'type': 'user',
                    'role': 'owner',
                    'emailAddress': user_email
                },
                transferOwnership=True, # এটিই ম্যাজিক প্যারামিটার
                fields='id'
            ).execute()
            logger.info(f"Ownership transferred to {user_email}")
        except Exception as e:
            # অনেক সময় পারমিশন আগে থেকে থাকলে বা ডোমেইন রেস্ট্রিকশন থাকলে এরর দিতে পারে
            logger.warning(f"Ownership transfer failed (Expected if already shared): {e}")

        logger.info(f"Drive-এ নতুন file তৈরি হয়েছে: {drive_file_name} (id={file_id})")

    return file_id

def append_to_drive_file(drive_file_id: str, new_content: str):
    """
    বিদ্যমান Drive file-এ নতুন content append করে।
    (পুরো file download → append → re-upload)
    """
    service = _get_drive_service()

    try:
        # বর্তমান content নামিয়ে আনো
        existing_bytes = service.files().get_media(fileId=drive_file_id).execute()
        existing_text = existing_bytes.decode('utf-8', errors='replace')
    except HttpError:
        existing_text = ''

    updated_content = existing_text + new_content

    media = MediaIoBaseUpload(
        io.BytesIO(updated_content.encode('utf-8')),
        mimetype='text/plain',
        resumable=False
    )
    service.files().update(fileId=drive_file_id, media_body=media).execute()
