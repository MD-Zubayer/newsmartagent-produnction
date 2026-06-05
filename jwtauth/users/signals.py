from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import Profile, OrderForm, FacebookPage, CustomerOrder
from users.utils import assign_unique_id
from django.contrib.auth import get_user_model
from datasheet.models import Spreadsheet
from aiAgent.models import AgentAI
import logging

logger = logging.getLogger(__name__)

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


# ─── INVOICE GENERATION & N8N DELIVERY ────────────────────────────────────

@receiver(post_save, sender=CustomerOrder)
def handle_order_created_invoice_n8n(sender, instance, created, **kwargs):
    """
    Signal handler triggered when a CustomerOrder is created.
    Generates invoice image using Playwright and sends via N8N to customer's platform.
    
    Args:
        sender: Model class (CustomerOrder)
        instance: The order instance
        created: Boolean indicating if this is a new creation
        **kwargs: Additional arguments from signal
    """
    
    # Only process on creation, not updates
    if not created:
        return

    if instance.invoice_sent:
        logger.info(f"⏹️ Invoice already marked sent for order #{instance.id}, skipping task dispatch")
        return

    if instance.invoice_task_dispatched:
        logger.info(f"⏹️ Invoice task already dispatched for order #{instance.id}, skipping duplicate enqueue")
        return

    try:
        logger.info(f"📦 New order created: {instance.id} for customer {instance.customer_name}")
        logger.info(f"   Platform: {instance.source_platform} | Contact: {instance.source_contact_id}")

        dispatched = CustomerOrder.objects.filter(id=instance.id, invoice_task_dispatched=False).update(invoice_task_dispatched=True)
        if not dispatched:
            logger.info(f"⏹️ Another process already marked order #{instance.id} as dispatched")
            return
        
        # Trigger async invoice generation safely on transaction commit
        from django.db import transaction
        from users.signals_tasks import generate_and_send_invoice_async_task
        transaction.on_commit(lambda: generate_and_send_invoice_async_task.delay(instance.id))
        
    except Exception as e:
        logger.error(f"❌ Error triggering invoice generation task: {e}", exc_info=True)


@receiver(post_save, sender=CustomerOrder)
def log_order_status(sender, instance, created, **kwargs):
    """
    Signal handler to log order status changes.
    """
    if created:
        logger.info(f"🆕 Order #{instance.id} created with status: {instance.status}")
    else:
        logger.info(f"♻️ Order #{instance.id} updated - Status: {instance.status}")
        
        