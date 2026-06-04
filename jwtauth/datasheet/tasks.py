from celery import shared_task
from django.contrib.auth import get_user_model
from embedding.utils import sync_spreadsheet_to_knowledge
from datasheet.models import Spreadsheet
from embedding.models import SpreadsheetKnowledge
import logging

logger = logging.getLogger('datasheet')
User = get_user_model()


@shared_task(bind=True)
def sync_spreadsheet_to_knowledge_task(self, user_id, grid_data, sheet_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.error(f"Spreadsheet sync failed: user {user_id} not found")
        return 0

    updated_rows = sync_spreadsheet_to_knowledge(user, grid_data, sheet_id)
    logger.info(f"Spreadsheet sync task completed for sheet={sheet_id}, rows={updated_rows}")
    return updated_rows


@shared_task(bind=True)
def run_auto_image_search_task(self, sheet_id):
    try:
        sheet = Spreadsheet.objects.get(pk=sheet_id)
    except Spreadsheet.DoesNotExist:
        logger.error(f"Auto image search failed: sheet {sheet_id} not found")
        return 0

    if not sheet.auto_image_search:
        logger.info(f"Auto image search skipped because setting is disabled for sheet {sheet_id}")
        return 0

    knowledge_rows = SpreadsheetKnowledge.objects.filter(user=sheet.user, row_id__startswith=f"sheet_{sheet_id}_")
    updated = 0
    for row in knowledge_rows:
        if not row.image_url:
            # TODO: implement Playwright or supplier-based image discovery here.
            logger.debug(f"Auto image search placeholder for row {row.row_id}")
        else:
            logger.debug(f"Row {row.row_id} already has image: {row.image_url}")
    logger.info(f"Auto image search placeholder completed for sheet={sheet_id}")
    return updated


def sync_primary_image_to_knowledge(user, row_id):
    """
    Synchronizes the primary image of a row (from RowImage model) to the corresponding
    SpreadsheetKnowledge model fields (image_url, image_caption, image_embedding).
    If no primary exists, it defaults to the first image, or clears the fields if no images exist.
    """
    from embedding.models import RowImage, SpreadsheetKnowledge
    from django.utils import timezone

    # Get primary image or the first image
    primary_img = RowImage.objects.filter(user=user, row_id=row_id, is_primary=True).first()
    if not primary_img:
        primary_img = RowImage.objects.filter(user=user, row_id=row_id).order_by('position', 'created_at').first()

    # Get or create SpreadsheetKnowledge object
    obj, created = SpreadsheetKnowledge.objects.get_or_create(
        user=user,
        row_id=row_id,
        defaults={'column_hashes': {}, 'content': ''}
    )

    if primary_img:
        obj.image_url = primary_img.image_url
        obj.image_caption = primary_img.image_caption or ''
        obj.image_embedding = primary_img.image_embedding
        obj.image_source = primary_img.source
        obj.image_updated_at = primary_img.updated_at or timezone.now()
    else:
        obj.image_url = ''
        obj.image_caption = ''
        obj.image_embedding = None
        obj.image_source = None
        obj.image_updated_at = None

    obj.save()


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=15,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300
)
def process_row_image_task(self, row_image_id):
    from embedding.models import RowImage
    from embedding.utils import get_gemini_image_embedding, get_image_caption
    from settings.models import GlobalSettings

    try:
        row_img = RowImage.objects.get(pk=row_image_id)
    except RowImage.DoesNotExist:
        logger.error(f"RowImage not found: {row_image_id}")
        return False

    image_url = row_img.image_url
    if not image_url:
        return False

    logger.info(f"Processing image API calls for RowImage {row_image_id}: {image_url}")

    # 1. Image Embedding
    image_vector = get_gemini_image_embedding(image_url)

    # 2. Caption
    global_settings = GlobalSettings.get_settings()
    selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
    
    # Try to find corresponding SpreadsheetKnowledge for fallback text
    from embedding.models import SpreadsheetKnowledge
    fallback_text = 'Product Image'
    try:
        obj = SpreadsheetKnowledge.objects.get(user=row_img.user, row_id=row_img.row_id)
        if obj.content:
            fallback_text = obj.content
    except SpreadsheetKnowledge.DoesNotExist:
        pass

    image_caption = get_image_caption(image_url, provider=selected_provider, fallback_text=fallback_text)

    # Save to RowImage
    row_img.image_caption = image_caption or ''
    if image_vector:
        row_img.image_embedding = image_vector
    row_img.save()

    # 3. Synchronize to SpreadsheetKnowledge if primary
    sync_primary_image_to_knowledge(row_img.user, row_img.row_id)

    # Introduce sleep delay to stagger consecutive API calls and prevent rate limiting
    import time
    time.sleep(2)

    return True

