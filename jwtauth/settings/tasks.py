import logging

from celery import shared_task

logger = logging.getLogger('aiAgent')


@shared_task(bind=True, queue='chat_queue', name='settings.comment_automation.process',
             max_retries=0, time_limit=60, soft_time_limit=50, expires=600)
def process_comment_task(self, payload):
    """Classify and plan the handling of one public comment."""
    from settings.comment_automation import process_comment
    try:
        return process_comment(payload)
    except Exception as exc:
        logger.error(f"[CommentAuto] process failed: {exc}", exc_info=True)
        return 'error'


@shared_task(bind=True, queue='chat_queue', name='settings.comment_automation.execute',
             max_retries=0, time_limit=60, soft_time_limit=50, expires=3600)
def execute_comment_plan_task(self, plan):
    """Run the Graph API actions (after the human-like delay)."""
    from settings.comment_automation import execute_comment_plan
    try:
        return execute_comment_plan(plan)
    except Exception as exc:
        logger.error(f"[CommentAuto] execute failed: {exc}", exc_info=True)
        return 'error'

