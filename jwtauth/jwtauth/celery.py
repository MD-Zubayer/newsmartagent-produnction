import os
from celery import Celery


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
