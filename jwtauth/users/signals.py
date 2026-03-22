from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import Profile, OrderForm, FacebookPage
from users.utils import assign_unique_id
from django.contrib.auth import get_user_model
from datasheet.models import Spreadsheet
from aiAgent.models import AgentAI

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
        
        
@receiver(post_save, sender=FacebookPage)
def sync_fb_page_to_agent(sender, instance, created, **kwargs):
    """
    Syncs FacebookPage data to AgentAI model.
    If AgentAI exists for this page_id, updates it; otherwise creates a new one.
    Defaults the name to the user's name.
    """
    # Calculate default name from user profile or email
    user_name = instance.user.name or instance.user.email.split('@')[0]
    
    try:
        agent = AgentAI.objects.defer('access_token').get(page_id=instance.page_id)
        agent_created = False
    except AgentAI.DoesNotExist:
        agent = AgentAI.objects.create(
            page_id=instance.page_id,
            user=instance.user,
            name=user_name,
            platform='messenger',
            access_token=instance.access_token,
            is_active=instance.is_active,
            system_prompt="You are a helpful AI assistant."
        )
        agent_created = True
    
    if not agent_created:
        agent.user = instance.user
        # We don't overwrite agent.name here to allow manual edits
        agent.access_token = instance.access_token
        agent.is_active = instance.is_active
        agent.save(update_fields=['user', 'access_token', 'is_active'])
@receiver(post_save, sender=User)
def ensure_user_order_form(sender, instance, **kwargs):
    
    obj, created = OrderForm.objects.get_or_create(user=instance)

    if created:
        print(f">>> New OrderForm generated for user: {instance.username}")
    else:
        print(f">>> OrderForm already exists for user: {instance.username}")
        
        
        