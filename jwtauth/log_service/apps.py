from django.apps import AppConfig


class LogServiceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'log_service'
    verbose_name = 'Log Service (Google Drive Sync)'
