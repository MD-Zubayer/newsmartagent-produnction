import os
from celery import Celery
from time import monotonic
from prometheus_client import Counter, Histogram
from celery.signals import task_prerun, task_postrun, task_failure
from .telemetry_client import enqueue_telemetry, automation_endpoint

TASKS = Counter("nsa_celery_tasks_total", "Celery tasks", ["task", "status"])
TASK_DURATION = Histogram("nsa_celery_task_duration_seconds", "Celery task duration", ["task"])
_TASK_START = {}

@task_prerun.connect
def _task_start(task_id=None, task=None, **kwargs):
    _TASK_START[task_id] = monotonic()

@task_postrun.connect
def _task_done(task_id=None, task=None, **kwargs):
    name = getattr(task, "name", "unknown")
    duration = (monotonic() - _TASK_START.pop(task_id, monotonic())) * 1000
    TASKS.labels(name[:100], "success").inc(); TASK_DURATION.labels(name[:100]).observe(duration / 1000)
    enqueue_telemetry({"kind": "task", "name": name[:100], "status": "success", "duration_ms": duration}, automation_endpoint())

@task_failure.connect
def _task_failed(task_id=None, task=None, **kwargs):
    name = getattr(task, "name", "unknown")
    duration = (monotonic() - _TASK_START.pop(task_id, monotonic())) * 1000
    TASKS.labels(name[:100], "error").inc(); TASK_DURATION.labels(name[:100]).observe(duration / 1000)
    enqueue_telemetry({"kind": "task", "name": name[:100], "status": "error", "duration_ms": duration}, automation_endpoint())



os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jwtauth.settings')

# # Setting the Django Settings module
app = Celery('jwtauth')
# Read all configurations starting with CELERY from settings
app.config_from_object('django.conf:settings', namespace='CELERY')
# Automatically find tasks.py for all apps
app.autodiscover_tasks()



@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
