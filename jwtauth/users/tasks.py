from celery import shared_task
import time


@shared_task
def slow_function(name):
    time.sleep(5)
    return f'Hello {name}, Celery is working'