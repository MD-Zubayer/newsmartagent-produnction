"""Background tasks for the users app."""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django.contrib.auth import get_user_model


logger = logging.getLogger(__name__)


@shared_task
def slow_function(name):
    """Legacy test task to confirm Celery is running."""
    import time

    time.sleep(5)
    return f"Hello {name}, Celery is working"


@shared_task(name="users.delete_unverified_accounts")
def delete_unverified_accounts():
    """Delete accounts that stayed unverified for more than one hour."""
    User = get_user_model()
    cutoff = timezone.now() - timedelta(hours=1)

    stale_qs = User.objects.filter(is_verified=False, created_at__lte=cutoff)
    count, _ = stale_qs.delete()

    if count:
        logger.info("Deleted %s unverified account(s) older than 1 hour", count)
    return {"deleted": count, "cutoff": cutoff.isoformat()}
