from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import Profile, OrderForm
from users.utils import assign_unique_id
from django.contrib.auth import get_user_model
from datasheet.models import Spreadsheet

User = get_user_model()
@receiver(post_save, sender=User)
def create_profile_on_register(sender, instance, created, **kwargs):
    if not created:
        return

    Profile.objects.create(
        user=instance,
        id_type=instance.id_type or "user",
        unique_id=assign_unique_id()
    )



User = get_user_model()

@receiver(post_save, sender=User)
def create_initial_spreadsheet(sender, instance, created, **kwargs):
    if created:

        Spreadsheet.objects.create(
            user = instance,
            title=f'{instance.name} s Workspace',
            rows=100,
            cols=26, 
            data={}
        )
        
        
@receiver(post_save, sender=User)
def ensure_user_order_form(sender, instance, **kwargs):
    
    obj, created = OrderForm.objects.get_or_create(user=instance)

    if created:
        print(f">>> New OrderForm generated for user: {instance.username}")
    else:
        print(f">>> OrderForm already exists for user: {instance.username}")
        
        
        