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
