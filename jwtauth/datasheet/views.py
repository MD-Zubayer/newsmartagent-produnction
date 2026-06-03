from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Spreadsheet
from .serializers import SpreadsheetSerializer
from embedding.utils import sync_spreadsheet_to_knowledge
from .tasks import run_auto_image_search_task, sync_spreadsheet_to_knowledge_task
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.urls import reverse
from django.conf import settings
from urllib.parse import urlparse
from embedding.utils import get_gemini_image_embedding
from django.db.models import Max

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
        from embedding.utils import get_image_caption
        from settings.models import GlobalSettings

        obj, created = self._get_row_knowledge(request, sheet, row_index)
        old_url = obj.image_url or ''
        if old_url and old_url != image_url:
            self._delete_storage_file(old_url)
        obj.image_url = image_url or ''

        if image_url:
            image_vector = get_gemini_image_embedding(image_url)
            # Use provider from GlobalSettings
            global_settings = GlobalSettings.get_settings()
            selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
            fallback_text = obj.content or 'Product Image'
            image_caption = get_image_caption(image_url, provider=selected_provider, fallback_text=fallback_text)
            obj.image_caption = image_caption or ''
            if image_vector:
                obj.image_embedding = image_vector
                obj.image_source = 'manual'
                from django.utils import timezone
                obj.image_updated_at = timezone.now()
        else:
            obj.image_caption = ''
            obj.image_embedding = None
            obj.image_source = None
            obj.image_updated_at = None

        obj.save()
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

                # Generate embeddings and caption
                image_vector = get_gemini_image_embedding(image_url)
                image_caption = get_image_caption(image_url, provider=selected_provider)

                # Create RowImage record
                row_img = RowImage.objects.create(
                    user=request.user,
                    row_id=row_id,
                    image_url=image_url,
                    image_filename=file_obj.name,
                    image_caption=image_caption or '',
                    image_embedding=image_vector,
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
            except Exception as e:
                return Response({'error': f'File upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        # Handle URL uploads
        for image_url in urls:
            if not image_url.strip():
                continue
            try:
                image_vector = get_gemini_image_embedding(image_url)
                image_caption = get_image_caption(image_url, provider=selected_provider)

                row_img = RowImage.objects.create(
                    user=request.user,
                    row_id=row_id,
                    image_url=image_url,
                    image_filename='external_url',
                    image_caption=image_caption or '',
                    image_embedding=image_vector,
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

        from embedding.utils import get_image_caption, get_gemini_image_embedding
        from settings.models import GlobalSettings

        # Handle replacement
        file_obj = request.FILES.get('file')
        new_image_url = request.data.get('image_url')
        
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
            
            # Regenerate embeddings
            global_settings = GlobalSettings.get_settings()
            selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
            
            image_vector = get_gemini_image_embedding(new_image_url)
            image_caption = get_image_caption(new_image_url, provider=selected_provider)
            image.image_embedding = image_vector
            image.image_caption = image_caption or ''

        elif new_image_url:
            # Update from URL
            delete_storage_file(image.image_url)
            image.image_url = new_image_url
            
            global_settings = GlobalSettings.get_settings()
            selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
            
            image_vector = get_gemini_image_embedding(new_image_url)
            image_caption = get_image_caption(new_image_url, provider=selected_provider)
            image.image_embedding = image_vector
            image.image_caption = image_caption or ''

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

        # Delete storage file
        delete_storage_file(image.image_url)
        
        # Delete record
        image.delete()
        
        return Response(status=status.HTTP_204_NO_CONTENT)


class RowImageSetPrimaryView(APIView):
    """
    🖼️ Set image as primary thumbnail
    POST /spreadsheets/{sheet_id}/row/images/{image_id}/set-primary/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, sheet_id, image_id):
        from embedding.models import RowImage
        
        try:
            image = RowImage.objects.get(id=image_id, user=request.user)
        except RowImage.DoesNotExist:
            return Response({'error': 'Image not found'}, status=status.HTTP_404_NOT_FOUND)

        # Clear other primary flags for this row
        RowImage.objects.filter(user=request.user, row_id=image.row_id, is_primary=True).exclude(pk=image.id).update(is_primary=False)
        
        # Set this as primary
        image.is_primary = True
        image.save()

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
            from django.utils import timezone
            
            row_id = f"sheet_{sheet_id}_row_{row_index}"
            
            # Get images for the row, ordered by position
            images = RowImage.objects.filter(
                user=request.user,
                row_id=row_id
            ).order_by('position')[:limit]
            
            if not images:
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
                'caller_info': caller_info,  # For audit logging
            })

        except Exception as e:
            return Response(
                {'error': f'Error fetching images: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
