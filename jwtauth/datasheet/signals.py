from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from datasheet.models import Spreadsheet


User = get_user_model()

@receiver(post_save, sender=User)
def create_initial_spreadsheet(sender, instance, created, **kwargs):
    if created:

        Spreadsheet.objects.create(
            title=f'{instance.name}',
            rows=100,
            cols=26, 
            data={}
        )