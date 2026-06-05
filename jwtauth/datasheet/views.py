from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
import logging

logger = logging.getLogger(__name__)
from .models import Spreadsheet
from .serializers import SpreadsheetSerializer
from embedding.utils import sync_spreadsheet_to_knowledge, rerank_images_with_llm
from .tasks import run_auto_image_search_task, sync_spreadsheet_to_knowledge_task
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.urls import reverse
from django.conf import settings
from django.utils import timezone
from urllib.parse import urlparse
from embedding.utils import get_gemini_image_embedding
from django.db.models import Max
from users.authentication import InternalServiceAuthentication

def normalize_storage_path(image_url):
    if not image_url:
        return None
    parsed = urlparse(image_url)
    path = parsed.path.lstrip('/')

    bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
    if bucket_name:
        bucket_name = bucket_name.rstrip('/')
        if path.startswith(f"{bucket_name}/"):
            return path[len(bucket_name) + 1:]

    media_prefix = settings.MEDIA_URL.lstrip('/') if settings.MEDIA_URL else ''
    if media_prefix and path.startswith(media_prefix):
        return path[len(media_prefix):]
    return path


def delete_storage_file(image_url):
    storage_path = normalize_storage_path(image_url)
    if not storage_path:
        return False
    try:
        default_storage.delete(storage_path)
        return True
    except Exception:
        return False

class SpreadsheetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sheets = Spreadsheet.objects.filter(user=request.user)
        serializer = SpreadsheetSerializer(sheets, many=True)
        return Response(serializer.data)

    def post(self, request):
        # রিকোয়েস্ট ডাটার সাথে ইউজারকে যুক্ত করে সেভ করা
        serializer = SpreadsheetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user) # ইউজার অটোমেটিক সেভ হবে
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SpreadsheetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Spreadsheet.objects.get(pk=pk, user=user)
        except Spreadsheet.DoesNotExist:
            return None

    def get(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SpreadsheetSerializer(sheet)
        return Response(serializer.data)

    def put(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = SpreadsheetSerializer(sheet, data=request.data, partial=True)
        if serializer.is_valid():
            saved_sheet = serializer.save()

            # ২. যদি রিকোয়েস্টে 'data' থাকে, তবে ক্লিনিং লজিক চলবে
            if 'data' in request.data:
                print("--- Triggering Smart Embedding Sync ---")
                
                raw_data = saved_sheet.data  # ডিকশনারি ফর্মেট: {'0-0': 'Head', '1-0': 'Value'}
                clean_data = {}
                rows_with_content = set()

                # ধাপ ১: কোন কোন রো-তে আসল তথ্য (Value) আছে তা খুঁজে বের করা
                for key, value in raw_data.items():
                    try:
                        r_idx = key.split('-')[0]
                        # রো যদি ০ না হয় (হেডার বাদে) এবং ভ্যালু যদি খালি না থাকে
                        if r_idx != "0" and str(value).strip():
                            rows_with_content.add(r_idx)
                    except (IndexError, AttributeError):
                        continue

                # ধাপ ২: হেডার রো (Row 0) এবং শুধু তথ্য থাকা রো গুলোকে আলাদা করা
                for key, value in raw_data.items():
                    r_idx = key.split('-')[0]
                    if r_idx == "0" or r_idx in rows_with_content:
                        clean_data[key] = value

                # ধাপ ৩: যদি কোনো ডেটা থাকে (হেডার বাদে), তবেই সিঙ্ক কল করা
                if rows_with_content:
                    if len(rows_with_content) > 40:
                        sync_spreadsheet_to_knowledge_task.delay(request.user.id, clean_data, saved_sheet.id)
                        print(f"Large sheet detected. Scheduled background sync task for Sheet {saved_sheet.id}.")
                    else:
                        updated_rows = sync_spreadsheet_to_knowledge(
                            user=request.user,
                            grid_data=clean_data,
                            sheet_id=saved_sheet.id
                        )
                        print(f"Total {updated_rows} valid rows updated in Knowledge Base.")
                    if saved_sheet.auto_image_search:
                        run_auto_image_search_task.delay(saved_sheet.id)
                        print(f"Auto image search scheduled for Sheet {saved_sheet.id}.")
                else:
                    # যদি কোনো ডেটা না থাকে, তবে নলেজ বেস থেকে ওই ইউজারের ডাটা ক্লিয়ার করে দেওয়া ভালো
                    from embedding.models import SpreadsheetKnowledge
                    SpreadsheetKnowledge.objects.filter(user=request.user, row_id__startswith=f"sheet_{saved_sheet.id}_").delete()
                    print(f"Knowledge base cleared for Sheet {saved_sheet.id}.")
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        from embedding.models import SpreadsheetKnowledge
        knowledge_rows = SpreadsheetKnowledge.objects.filter(user=request.user, row_id__startswith=f"sheet_{pk}_")
        for row in knowledge_rows:
            if row.image_url:
                delete_storage_file(row.image_url)
        knowledge_rows.delete()
        
        sheet.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RowImageUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Spreadsheet.objects.get(pk=pk, user=user)
        except Spreadsheet.DoesNotExist:
            return None

    def _normalize_storage_path(self, image_url):
        if not image_url:
            return None
        parsed = urlparse(image_url)
        path = parsed.path.lstrip('/')

        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', None)
        if bucket_name:
            bucket_name = bucket_name.rstrip('/')
            if path.startswith(f"{bucket_name}/"):
                return path[len(bucket_name) + 1:]

        media_prefix = settings.MEDIA_URL.lstrip('/') if settings.MEDIA_URL else ''
        if media_prefix and path.startswith(media_prefix):
            return path[len(media_prefix):]
        return path

    def _delete_storage_file(self, image_url):
        return delete_storage_file(image_url)

    def _save_uploaded_image(self, request, sheet, file_obj, row_index):
        filename = f'user_{request.user.id}/sheet_{sheet.id}/row_{row_index}/{file_obj.name}'
        saved_path = default_storage.save(filename, ContentFile(file_obj.read()))
        try:
            return default_storage.url(saved_path)
        except Exception:
            return saved_path

    def _get_row_knowledge(self, request, sheet, row_index):
        from embedding.models import SpreadsheetKnowledge
        row_unique_id = f"sheet_{sheet.id}_row_{row_index}"
        return SpreadsheetKnowledge.objects.get_or_create(
            user=request.user,
            row_id=row_unique_id,
            defaults={'column_hashes': {}, 'content': ''}
        )

    def _update_row_image(self, request, sheet, row_index, image_url):
        from embedding.models import RowImage
        from .tasks import process_row_image_task, sync_primary_image_to_knowledge

        row_id = f"sheet_{sheet.id}_row_{row_index}"
        
        # 1. Update/clear SpreadsheetKnowledge basic URL field
        obj, created = self._get_row_knowledge(request, sheet, row_index)
        old_url = obj.image_url or ''
        if old_url and old_url != image_url:
            self._delete_storage_file(old_url)
            # Delete corresponding RowImage if URL changed
            RowImage.objects.filter(user=request.user, row_id=row_id, image_url=old_url).delete()

        obj.image_url = image_url or ''
        obj.save()

        if image_url:
            # Check if RowImage already exists for this URL
            row_img, img_created = RowImage.objects.get_or_create(
                user=request.user,
                row_id=row_id,
                image_url=image_url,
                defaults={
                    'image_filename': 'single_upload',
                    'is_primary': True,
                    'source': 'manual'
                }
            )
            
            # Ensure it is primary
            if not row_img.is_primary:
                row_img.is_primary = True
                row_img.save()
            
            # Clear other primary flags
            RowImage.objects.filter(user=request.user, row_id=row_id, is_primary=True).exclude(pk=row_img.id).update(is_primary=False)
            
            # Defer API calls to background Celery task
            process_row_image_task.delay(row_img.id)
        else:
            # If image cleared, remove all row images and clear sync
            RowImage.objects.filter(user=request.user, row_id=row_id).delete()
            sync_primary_image_to_knowledge(request.user, row_id)

        obj.refresh_from_db()
        return obj

    def post(self, request, pk):
        """Upload an image file for a specific row.

        Expected form-data: file (image), row_index (string or int)
        """
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        row_index = request.data.get('row_index')
        if not row_index:
            return Response({'error': 'row_index is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        url = self._save_uploaded_image(request, sheet, file_obj, row_index)
        obj = self._update_row_image(request, sheet, row_index, url)

        return Response({'image_url': obj.image_url}, status=status.HTTP_201_CREATED)

    def put(self, request, pk):
        """Update row image metadata by URL or replace with new file."""
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        row_index = request.data.get('row_index')
        image_url = request.data.get('image_url')
        file_obj = request.FILES.get('file')

        if not row_index:
            return Response({'error': 'row_index is required'}, status=status.HTTP_400_BAD_REQUEST)

        refresh_caption = str(request.data.get('refresh_caption', '')).lower() in ['true', '1', 'yes']

        if not file_obj and not image_url and not refresh_caption:
            return Response({'error': 'image_url or file is required'}, status=status.HTTP_400_BAD_REQUEST)

        if refresh_caption and not file_obj and not image_url:
            from embedding.models import SpreadsheetKnowledge
            row_unique_id = f"sheet_{sheet.id}_row_{row_index}"
            try:
                row_obj = SpreadsheetKnowledge.objects.get(user=request.user, row_id=row_unique_id)
            except SpreadsheetKnowledge.DoesNotExist:
                return Response({'error': 'No existing row image found for this row'}, status=status.HTTP_404_NOT_FOUND)

            if not row_obj.image_url:
                return Response({'error': 'No image URL stored for this row'}, status=status.HTTP_400_BAD_REQUEST)

            obj = self._update_row_image(request, sheet, row_index, row_obj.image_url)
            return Response({'image_url': obj.image_url, 'image_caption': obj.image_caption or ''}, status=status.HTTP_200_OK)

        if file_obj:
            image_url = self._save_uploaded_image(request, sheet, file_obj, row_index)

        obj = self._update_row_image(request, sheet, row_index, image_url)
        return Response({'image_url': obj.image_url, 'image_caption': obj.image_caption or ''}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        row_index = request.data.get('row_index')
        if not row_index:
            return Response({'error': 'row_index is required'}, status=status.HTTP_400_BAD_REQUEST)

        from embedding.models import SpreadsheetKnowledge
        row_unique_id = f"sheet_{sheet.id}_row_{row_index}"
        try:
            obj = SpreadsheetKnowledge.objects.get(user=request.user, row_id=row_unique_id)
        except SpreadsheetKnowledge.DoesNotExist:
            return Response({'message': 'No row image found'}, status=status.HTTP_404_NOT_FOUND)

        if obj.image_url:
            self._delete_storage_file(obj.image_url)
        obj.image_url = ''
        obj.image_embedding = None
        obj.image_source = None
        obj.image_updated_at = None
        obj.save()

        return Response(status=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 🖼️ NEW: Multi-Image Management Endpoints
# ============================================================================

class RowImagesListCreateView(APIView):
    """
    🖼️ Multi-image management for rows
    GET  /spreadsheets/{sheet_id}/rows/{row_index}/images/  - List all images for a row
    POST /spreadsheets/{sheet_id}/rows/{row_index}/images/  - Upload multiple images
    """
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Spreadsheet.objects.get(pk=pk, user=user)
        except Spreadsheet.DoesNotExist:
            return None

    def get(self, request, sheet_id, row_index):
        """Get all images for a specific row"""
        sheet = self.get_object(sheet_id, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        from embedding.models import RowImage
        row_id = f"sheet_{sheet_id}_row_{row_index}"
        images = RowImage.objects.filter(user=request.user, row_id=row_id).order_by('position')
        
        image_list = []
        for img in images:
            image_list.append({
                'id': img.id,
                'url': img.image_url,
                'filename': img.image_filename,
                'caption': img.image_caption,
                'is_primary': img.is_primary,
                'position': img.position,
                'source': img.source,
                'created_at': img.created_at.isoformat(),
            })
        
        return Response({
            'row_id': row_id,
            'sheet_id': sheet_id,
            'row_index': row_index,
            'images': image_list,
            'total': len(image_list)
        })

    def post(self, request, sheet_id, row_index):
        """Upload one or multiple images for a row"""
        sheet = self.get_object(sheet_id, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        files = request.FILES.getlist('files')
        urls = request.data.getlist('urls')
        
        if not files and not urls:
            return Response({'error': 'files or urls are required'}, status=status.HTTP_400_BAD_REQUEST)

        from embedding.models import RowImage
        from embedding.utils import get_image_caption, get_gemini_image_embedding
        from settings.models import GlobalSettings
        from django.utils import timezone

        row_id = f"sheet_{sheet_id}_row_{row_index}"
        uploaded_images = []
        
        # Get current max position
        max_position = RowImage.objects.filter(user=request.user, row_id=row_id).aggregate(
            Max('position')
        )['position__max'] or -1
        position = max_position + 1

        global_settings = GlobalSettings.get_settings()
        selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'

        # Handle file uploads
        for file_obj in files:
            try:
                # Save file to storage
                filename = f'user_{request.user.id}/sheet_{sheet_id}/row_{row_index}/{file_obj.name}'
                saved_path = default_storage.save(filename, ContentFile(file_obj.read()))
                image_url = default_storage.url(saved_path)

                # Create RowImage record with empty captions and embeddings
                row_img = RowImage.objects.create(
                    user=request.user,
                    row_id=row_id,
                    image_url=image_url,
                    image_filename=file_obj.name,
                    image_caption='',
                    image_embedding=None,
                    source='manual',
                    position=position
                )
                position += 1

                # Set first uploaded image as primary
                if len(uploaded_images) == 0 and len(files) > 0:
                    row_img.is_primary = True
                    row_img.save()

                uploaded_images.append({
                    'id': row_img.id,
                    'url': row_img.image_url,
                    'filename': row_img.image_filename,
                })

                # Defer API calls to background Celery task
                from .tasks import process_row_image_task
                process_row_image_task.delay(row_img.id)

            except Exception as e:
                return Response({'error': f'File upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle URL uploads
        for image_url in urls:
            if not image_url.strip():
                continue
            try:
                row_img = RowImage.objects.create(
                    user=request.user,
                    row_id=row_id,
                    image_url=image_url,
                    image_filename='external_url',
                    image_caption='',
                    image_embedding=None,
                    source='manual',
                    position=position
                )
                position += 1

                # Set first URL image as primary if no file uploads
                if len(uploaded_images) == 0 and len(urls) > 0:
                    row_img.is_primary = True
                    row_img.save()

                uploaded_images.append({
                    'id': row_img.id,
                    'url': row_img.image_url,
                    'filename': 'external',
                })

                # Defer API calls to background Celery task
                from .tasks import process_row_image_task
                process_row_image_task.delay(row_img.id)

            except Exception as e:
                continue  # Skip failed URLs, don't block batch upload


        if not uploaded_images:
            return Response({'error': 'No images could be uploaded'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'row_id': row_id,
            'uploaded': uploaded_images,
            'total': len(uploaded_images)
        }, status=status.HTTP_201_CREATED)


class RowImageDetailView(APIView):
    """
    🖼️ Individual image operations
    PATCH /spreadsheets/{sheet_id}/row/images/{image_id}/  - Update/replace image
    DELETE /spreadsheets/{sheet_id}/row/images/{image_id}/ - Delete image
    """
    permission_classes = [IsAuthenticated]

    def get_image(self, image_id, user):
        try:
            from embedding.models import RowImage
            return RowImage.objects.get(id=image_id, user=user)
        except RowImage.DoesNotExist:
            return None

    def patch(self, request, sheet_id, image_id):
        """Update image: replace, set primary, update caption"""
        image = self.get_image(image_id, request.user)
        if not image:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

        from .tasks import process_row_image_task, sync_primary_image_to_knowledge

        # Handle replacement
        file_obj = request.FILES.get('file')
        new_image_url = request.data.get('image_url')
        trigger_task = False
        
        if file_obj:
            # Parse row info from row_id
            row_id_parts = image.row_id.split('_')
            sheet_id_val = row_id_parts[1]
            row_index = row_id_parts[3]
            
            # Save new file
            filename = f'user_{request.user.id}/sheet_{sheet_id_val}/row_{row_index}/{file_obj.name}'
            saved_path = default_storage.save(filename, ContentFile(file_obj.read()))
            new_image_url = default_storage.url(saved_path)
            
            # Delete old file
            delete_storage_file(image.image_url)
            
            # Update image
            image.image_url = new_image_url
            image.image_filename = file_obj.name
            image.image_embedding = None
            image.image_caption = ''
            trigger_task = True

        elif new_image_url:
            # Update from URL
            delete_storage_file(image.image_url)
            image.image_url = new_image_url
            image.image_filename = 'external_url'
            image.image_embedding = None
            image.image_caption = ''
            trigger_task = True

        # Handle caption update
        caption = request.data.get('caption')
        if caption is not None:
            image.image_caption = caption

        # Handle set as primary
        set_primary = request.data.get('is_primary', False)
        if set_primary:
            from embedding.models import RowImage
            RowImage.objects.filter(user=request.user, row_id=image.row_id, is_primary=True).exclude(pk=image.id).update(is_primary=False)
            image.is_primary = True

        image.save()

        if trigger_task:
            process_row_image_task.delay(image.id)
        else:
            sync_primary_image_to_knowledge(request.user, image.row_id)
        
        return Response({
            'id': image.id,
            'url': image.image_url,
            'filename': image.image_filename,
            'caption': image.image_caption,
            'is_primary': image.is_primary,
        })

    def delete(self, request, sheet_id, image_id):
        """Delete a specific image"""
        image = self.get_image(image_id, request.user)
        if not image:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

        row_id = image.row_id

        # Delete storage file
        delete_storage_file(image.image_url)
        
        # Delete record
        image.delete()

        # Update primary image in SpreadsheetKnowledge
        from .tasks import sync_primary_image_to_knowledge
        sync_primary_image_to_knowledge(request.user, row_id)
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class RowImageSetPrimaryView(APIView):
    """
    🖼️ Set image as primary thumbnail
    POST /spreadsheets/{sheet_id}/row/images/{image_id}/set-primary/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, sheet_id, image_id):
        from embedding.models import RowImage
        from .tasks import sync_primary_image_to_knowledge
        
        try:
            image = RowImage.objects.get(id=image_id, user=request.user)
        except RowImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

        # Clear other primary flags for this row
        RowImage.objects.filter(user=request.user, row_id=image.row_id, is_primary=True).exclude(pk=image.id).update(is_primary=False)
        
        # Set this as primary
        image.is_primary = True
        image.save()

        # Synchronize new primary image details to SpreadsheetKnowledge
        sync_primary_image_to_knowledge(request.user, image.row_id)

        return Response({'is_primary': True})


# ============================================================================
# 🔐 PLATFORM-RESTRICTED IMAGE DELIVERY (Presigned URLs)
# ============================================================================

class RowImagePresignedURLView(APIView):
    """
    🔐 Generate platform-restricted presigned URLs for row images
    GET /spreadsheets/{sheet_id}/row-image-presigned-url/
    
    Parameters:
    - row_index: The row to fetch images from
    - platform: The platform requesting the image (whatsapp, messenger, instagram, telegram, tiktok)
    - limit: Max images to return (default: 3)
    
    Response:
    {
        "presigned_urls": [
            {"url": "https://minio.../file.jpg?X-Amz-Signature=...", "caption": "Product XYZ", "position": 0}
        ],
        "row_id": "sheet_5_row_2",
        "platform": "whatsapp",
        "expires_in": 60
    }
    """
    authentication_classes = [InternalServiceAuthentication]
    permission_classes = [IsAuthenticated]
    
    # Allowed platforms
    ALLOWED_PLATFORMS = ['whatsapp', 'messenger', 'instagram', 'telegram', 'tiktok']

    def get_object(self, pk, user):
        try:
            return Spreadsheet.objects.get(pk=pk, user=user)
        except Spreadsheet.DoesNotExist:
            return None

    def _get_minio_client(self):
        """Initialize MinIO/S3 client"""
        import boto3
        from django.conf import settings
        
        minio_config = {
            'aws_access_key_id': getattr(settings, 'AWS_ACCESS_KEY_ID', ''),
            'aws_secret_access_key': getattr(settings, 'AWS_SECRET_ACCESS_KEY', ''),
            'endpoint_url': getattr(settings, 'AWS_S3_ENDPOINT_URL', ''),
        }
        
        return boto3.client('s3', **minio_config)

    def _is_minio_url(self, url):
        """Check if URL is from MinIO/S3 storage"""
        minio_domain = getattr(settings, 'AWS_S3_ENDPOINT_URL', '')
        return minio_domain and minio_domain in url

    def _extract_s3_key(self, url):
        """Extract S3 key from URL"""
        from urllib.parse import urlparse, unquote
        
        parsed = urlparse(url)
        path = unquote(parsed.path)
        
        # Remove leading slash and bucket name if present
        bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', '')
        if bucket_name:
            expected_prefix = f"/{bucket_name.rstrip('/')}/"
            if path.startswith(expected_prefix):
                return path[len(expected_prefix):]
        
        # Remove leading slash
        if path.startswith('/'):
            return path[1:]
        
        return path

    def _generate_presigned_url(self, image_url, expiration=60):
        """
        Generate presigned URL for image
        
        If it's a MinIO URL: Generate fresh presigned URL via boto3
        If it's external URL: Return as-is (can't be presigned)
        """
        if not self._is_minio_url(image_url):
            # External URLs can't be presigned
            return image_url

        try:
            client = self._get_minio_client()
            s3_key = self._extract_s3_key(image_url)
            bucket_name = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'newsmart')
            
            presigned_url = client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )
            
            return presigned_url
        except Exception as e:
            print(f"Error generating presigned URL: {str(e)}")
            # Fallback to original URL
            return image_url

    def get(self, request, sheet_id):
        """
        GET /spreadsheets/{sheet_id}/row-image-presigned-url/
        Query params: row_index, platform, limit
        """
        sheet = self.get_object(sheet_id, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        # Get parameters
        row_index = request.query_params.get('row_index')
        platform = request.query_params.get('platform', '').lower()
        limit = int(request.query_params.get('limit', 3))
        query = request.query_params.get('query', '').strip()
        offset = int(request.query_params.get('offset', 0))
        
        # Validate row_index
        if not row_index:
            return Response(
                {'error': 'row_index is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate platform
        if platform not in self.ALLOWED_PLATFORMS:
            return Response(
                {
                    'error': f'Invalid platform. Allowed: {", ".join(self.ALLOWED_PLATFORMS)}',
                    'allowed_platforms': self.ALLOWED_PLATFORMS
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Platform verification: Store calling info for audit
        # In production, verify webhook signature or token here
        caller_info = {
            'platform': platform,
            'user_id': request.user.id,
            'timestamp': str(settings.USE_TZ and timezone.now() or None),
            'ip': request.META.get('REMOTE_ADDR', ''),
        }

        try:
            from embedding.models import RowImage
            
            row_id = f"sheet_{sheet_id}_row_{row_index}"
            
            # Get images for the row, ordered by position
            images_qs = RowImage.objects.filter(
                user=request.user,
                row_id=row_id
            )
            
            if query:
                # ─────────────────────────────────────────────────────────
                # Stage 1 — True Hybrid Retrieval (3 signals)
                #
                #  Signal A: query_text_vector ↔ DB image_embedding  (W=0.5)
                #            (cross-modal: text query vs visual embedding)
                #  Signal B: query_text_vector ↔ DB text_embedding   (W=0.4)
                #            (text query vs text/caption embedding)
                #  Signal C: caption keyword match                    (−0.10 bonus)
                #
                #  hybrid_score = W_A*img_dist + W_B*txt_dist - colour_bonus - caption_bonus
                #  (lower score = better match)
                # ─────────────────────────────────────────────────────────
                from embedding.utils import get_gemini_embedding
                from pgvector.django import CosineDistance

                # ── Weight knobs ──
                W_IMG_EMB    = 0.5    # text query vs image_embedding column
                W_TXT_EMB    = 0.4    # text query vs text_embedding column
                CAPTION_BONUS = 0.10  # bonus for keyword hit in caption
                COLOUR_BONUS  = 0.10  # bonus for colour synonym match in caption
                MAX_CANDIDATES   = 20
                DISTANCE_THRESHOLD = 0.75

                # ── Colour synonym map (Bangla + English) ──
                COLOUR_SYNONYMS = {
    'kalo':   ['black', 'dark', 'jet black', 'charcoal', 'কালো', 'কুচকুচে'],
    'shada':  ['white', 'light', 'off-white', 'snow white', 'সাদা', 'ধবধবে'],
    'lal':    ['red', 'maroon', 'crimson', 'scarlet', 'burgundy', 'লাল', 'খয়েরি', 'টকটকে লাল'],
    'neel':   ['blue', 'navy', 'sky blue', 'royal blue', 'azure', 'নীল', 'আকাশি'],
    'holud':  ['yellow', 'mustard', 'lemon', 'golden', 'হলুদ', 'সরিষা রঙ', 'সোনালী'],
    'sabuj':  ['green', 'olive', 'emerald', 'teal', 'mint', 'সবুজ', 'অলিভ', 'কলাপাতা'],
    'badami': ['brown', 'chocolate', 'coffee', 'tan', 'beige', 'বাদামি', 'কফি', 'চকলেট'],
    'khaki':  ['khaki', 'dusty', 'sand', 'olive drab', 'খাকি', 'মাটি রঙ'],
    'beguni': ['purple', 'violet', 'magenta', 'lavender', 'plum', 'বেগুনি', 'জাম রঙ'],
    'golapi': ['pink', 'rose', 'fuchsia', 'baby pink', 'গোলাপি', 'পিঙ্ক'],
    'komola': ['orange', 'peach', 'apricot', 'saffron', 'কমলা', 'গেরুয়া'],
    'dhushor':['grey', 'gray', 'silver', 'ash', 'slate', 'ধূসর', 'ছাই রঙ', 'সিলভার'],
    'tamate': ['copper', 'bronze', 'metallic', 'তামাটে', 'ব্রোঞ্জ'],
    'feka':   ['pale', 'pastel', 'faded', 'ফ্যাকাশে'],
}

                def _colour_bonus(caption_text: str, q: str) -> float:
                    q_lower      = q.lower()
                    caption_lower = caption_text.lower()
                    for key, synonyms in COLOUR_SYNONYMS.items():
                        all_terms = [key] + synonyms
                        if any(t in q_lower for t in all_terms):
                            if any(t in caption_lower for t in all_terms):
                                return COLOUR_BONUS
                    return 0.0

                def _caption_kw_bonus(caption_text: str, q: str) -> float:
                    caption_lower = caption_text.lower()
                    for word in q.lower().split():
                        if len(word) >= 3 and word in caption_lower:
                            return CAPTION_BONUS
                    return 0.0

                # ── Step 1: ONE text embedding for the query ──
                # Used for BOTH image_embedding and text_embedding searches.
                logger.info("Hybrid search initiated. Query: '%s'", query)
                query_vector = get_gemini_embedding(query)

                seen_ids = {}

                if query_vector:
                    # ── Signal A: text query vector ↔ DB image_embedding column ──
                    # Cross-modal: the query text is embedded as text and compared
                    # against image embeddings stored in the DB (generated from actual images).
                    img_emb_qs = images_qs.annotate(
                        img_dist=CosineDistance('image_embedding', query_vector)
                    ).filter(image_embedding__isnull=False, img_dist__lt=DISTANCE_THRESHOLD)

                    img_candidates_list = list(img_emb_qs[:MAX_CANDIDATES])
                    logger.info("Signal A (Visual Embedding): Found %d candidates under threshold %s", len(img_candidates_list), DISTANCE_THRESHOLD)

                    for img in img_candidates_list:
                        logger.debug("Signal A Candidate: ID %s, Visual Dist: %f", img.id, float(img.img_dist))
                        seen_ids[img.id] = {
                            'img': img,
                            'img_dist': float(img.img_dist),
                            'txt_dist': 1.0,
                        }

                    # ── Signal B: text query vector ↔ DB caption_embedding column ──
                    # Same-modal: product description / caption text embeddings.
                    txt_emb_qs = images_qs.annotate(
                        txt_dist=CosineDistance('caption_embedding', query_vector)
                    ).filter(caption_embedding__isnull=False, txt_dist__lt=DISTANCE_THRESHOLD)

                    txt_candidates_list = list(txt_emb_qs[:MAX_CANDIDATES])
                    logger.info("Signal B (Text Embedding): Found %d candidates under threshold %s", len(txt_candidates_list), DISTANCE_THRESHOLD)

                    for img in txt_candidates_list:
                        logger.debug("Signal B Candidate: ID %s, Text Dist: %f", img.id, float(img.txt_dist))
                        if img.id in seen_ids:
                            seen_ids[img.id]['txt_dist'] = float(img.txt_dist)
                        else:
                            seen_ids[img.id] = {
                                'img': img,
                                'img_dist': 1.0,
                                'txt_dist': float(img.txt_dist),
                            }

                    # Calculate the final unified hybrid score for all gathered candidates
                    logger.info("Calculating hybrid scores for %d unique candidates", len(seen_ids))
                    for candidate in seen_ids.values():
                        img = candidate['img']
                        img_dist = candidate['img_dist']
                        txt_dist = candidate['txt_dist']
                        cb = _colour_bonus(img.image_caption or '', query)
                        kb = _caption_kw_bonus(img.image_caption or '', query)
                        candidate['hybrid_score'] = W_IMG_EMB * img_dist + W_TXT_EMB * txt_dist - cb - kb
                        logger.info(
                            "Candidate ID %s (%s): visual_dist=%f (w=%s), text_dist=%f (w=%s), cb=%f, kb=%f => hybrid_score=%f",
                            img.id, img.image_caption or "No Caption", img_dist, W_IMG_EMB, txt_dist, W_TXT_EMB, cb, kb, candidate['hybrid_score']
                        )
                else:
                    logger.warning("Could not generate query embedding vector for query: '%s'", query)

                # ── Signal C: caption keyword fallback ──
                # If BOTH embedding searches returned nothing (no embeddings stored yet),
                # fall back to simple keyword match on caption text so we never return empty.
                if not seen_ids:
                    logger.info("Both embedding searches returned 0 candidates. Triggering Signal C (caption keyword fallback) for query: '%s'", query)
                    for word in query.split():
                        if len(word) < 3:
                            continue
                        kw_qs = images_qs.filter(image_caption__icontains=word)
                        kw_candidates = list(kw_qs[:MAX_CANDIDATES])
                        logger.info("Keyword '%s' fallback: Found %d matching candidates", word, len(kw_candidates))
                        for img in kw_candidates:
                            if img.id not in seen_ids:
                                seen_ids[img.id] = {
                                    'img': img,
                                    'hybrid_score': 0.5,
                                    'img_dist': 1.0,
                                    'txt_dist': 1.0,
                                }
                                logger.info("Signal C Candidate: ID %s (%s) mapped with neutral score 0.5", img.id, img.image_caption or "No Caption")

                if seen_ids:
                    sorted_candidates = sorted(seen_ids.values(), key=lambda x: x['hybrid_score'])

                    llm_input = [
                        {
                            'image_id':     c['img'].id,
                            'caption':      c['img'].image_caption or '',
                            'hybrid_score': c['hybrid_score'],
                            'img_dist':     c['img_dist'],
                            'txt_dist':     c['txt_dist'],
                            '_obj':         c['img'],
                        }
                        for c in sorted_candidates[:MAX_CANDIDATES]
                    ]
                    logger.info("Candidates sorted by hybrid score: %s", [(c['image_id'], round(c['hybrid_score'], 4)) for c in llm_input])

                    # ── Python-side Color Filtering ──
                    def _filter_images_by_color(q: str, candidates: list) -> list:
                        q_lower = q.lower()
                        requested_groups = set()
                        for group_name, synonyms in COLOUR_SYNONYMS.items():
                            all_terms = [group_name] + synonyms
                            if any(t in q_lower for t in all_terms):
                                requested_groups.add(group_name)
                        
                        if not requested_groups:
                            return candidates
                            
                        filtered = []
                        for item in candidates:
                            img_obj = item['_obj']
                            caption = (img_obj.image_caption or '').lower()
                            
                            mentions_requested = False
                            mentions_other = False
                            
                            for group_name, synonyms in COLOUR_SYNONYMS.items():
                                all_terms = [group_name] + synonyms
                                if any(t in caption for t in all_terms):
                                    if group_name in requested_groups:
                                        mentions_requested = True
                                    else:
                                        mentions_other = True
                                        
                            # Exclude only if it explicitly mentions a different color, and NOT the requested color
                            if mentions_other and not mentions_requested:
                                logger.info(f"Filtering out image ID {img_obj.id} because color doesn't match requested {requested_groups}")
                                continue
                            filtered.append(item)
                        return filtered

                    llm_input = _filter_images_by_color(query, llm_input)
                    logger.info("Candidates after color filtering: %s", [c['image_id'] for c in llm_input])

                    # ── Stage 2: LLM Re-ranking (Gemini cross-encoder) ──
                    try:
                        logger.info("Running Stage 4 (LLM Re-ranking) via Gemini for query: '%s'", query)
                        reranked = rerank_images_with_llm(query, llm_input)
                        logger.info("Gemini re-ranking finished. Final ordered IDs: %s", [c['image_id'] for c in reranked])
                    except Exception as e:
                        logger.error("LLM re-ranking failed, falling back to hybrid score sorting: %s", str(e))
                        reranked = llm_input

                    images_qs = [c['_obj'] for c in reranked]
                else:
                    logger.info("No candidates found via embeddings or keyword fallback. Returning images ordered by position.")
                    images_qs = list(images_qs.order_by('position')[:MAX_CANDIDATES])
            else:
                images_qs = list(images_qs.order_by('position'))

            # images_qs may now be a plain Python list (after re-ranking) or a QS
            if not isinstance(images_qs, list) and hasattr(images_qs, 'count'):
                total_matching = images_qs.count()
                images = list(images_qs[offset:offset+limit])
            else:
                total_matching = len(images_qs)
                images = images_qs[offset:offset+limit]
            
            if not images and offset == 0:
                return Response(
                    {'error': 'No images found for this row'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Generate presigned URLs
            presigned_data = []
            expiration = 60  # 60 seconds
            
            for img in images:
                presigned_url = self._generate_presigned_url(img.image_url, expiration)
                
                presigned_data.append({
                    'url': presigned_url,
                    'caption': img.image_caption,
                    'position': img.position,
                    'source': img.source,
                    'image_id': img.id,
                })

            return Response({
                'presigned_urls': presigned_data,
                'row_id': row_id,
                'platform': platform,
                'expires_in': expiration,
                'total': len(presigned_data),
                'total_matching': total_matching,
                'offset': offset,
                'caller_info': caller_info,  # For audit logging
            })

        except Exception as e:
            return Response(
                {'error': f'Error fetching images: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
