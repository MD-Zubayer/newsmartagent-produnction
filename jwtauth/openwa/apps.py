from django.apps import AppConfig


class OpenwaConfig(AppConfig):
    name = 'openwa'

    def ready(self):
        # Import signals to wire up model hooks
        from . import signals  # noqa: F401
