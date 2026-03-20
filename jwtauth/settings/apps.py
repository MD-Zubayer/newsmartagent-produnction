from django.apps import AppConfig


def _ensure_periodic_tasks():
    """Seed/refresh periodic tasks so they appear in Django admin.

    Runs on app ready; safe to call multiple times. Skips if DB not ready.
    """

    from django.conf import settings
    from django.db.utils import OperationalError, ProgrammingError

    try:
        from django_celery_beat.models import CrontabSchedule, PeriodicTask
    except Exception:
        return

    schedules = [
        {
            "name": "sync-logs-to-google-drive",
            "task": "log_service.sync_logs_to_drive",
            "cron": {"minute": "*/5", "hour": "*"},
        },
        {
            "name": "backup-database-to-google-drive",
            "task": "log_service.backup_db_to_drive",
            "cron": {"minute": "0", "hour": "1"},
        },
        {
            "name": "backup-redis-to-google-drive",
            "task": "log_service.backup_redis_to_drive",
            "cron": {"minute": "0", "hour": "2"},
        },
        {
            "name": "delete-unverified-accounts",
            "task": "users.delete_unverified_accounts",
            "cron": {"minute": "*/10", "hour": "*"},
        },
    ]

    for item in schedules:
        try:
            cron, _ = CrontabSchedule.objects.get_or_create(
                minute=item["cron"].get("minute", "*"),
                hour=item["cron"].get("hour", "*"),
                day_of_week=item["cron"].get("day_of_week", "*"),
                day_of_month=item["cron"].get("day_of_month", "*"),
                month_of_year=item["cron"].get("month_of_year", "*"),
                timezone=getattr(settings, "TIME_ZONE", "UTC"),
            )

            PeriodicTask.objects.update_or_create(
                name=item["name"],
                defaults={
                    "task": item["task"],
                    "crontab": cron,
                    "enabled": True,
                },
            )
        except (OperationalError, ProgrammingError):
            # DB or tables not ready (e.g., during initial migrate); skip quietly
            return



class SettingsConfig(AppConfig):
    name = 'settings'

    def ready(self):
        _ensure_periodic_tasks()
