from django.db.models.signals import post_save
from django.dispatch import receiver
from man_agent.utils import distribute_agent_commission
from users.models import Subscription
from django.db import transaction


@receiver(post_save, sender=Subscription)
def trigger_commission_on_save(sender, instance, created, **kwargs):
    
    if created and instance.is_active:
        transaction.on_commit(lambda: distribute_agent_commission(instance))

