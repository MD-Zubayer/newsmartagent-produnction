import logging
from django.db import transaction
from django.utils import timezone
from users.models import Payment, Profile, Offer

logger = logging.getLogger(__name__)

def check_and_trigger_auto_renew(profile: Profile):
    """
    Checks if auto-renew is needed and triggers it if conditions are met.
    Conditions:
    1. word_balance < 2000
    2. auto_renew_enabled is True in AgentSettings
    3. auto_renew_offer is selected
    4. profile.acount_balance >= offer.price
    """
    try:
        from settings.models import AgentSettings
        settings, created = AgentSettings.objects.get_or_create(user=profile.user)
        
        if not settings.auto_renew_enabled or not settings.auto_renew_offer:
            return

        # Check if balance is below threshold
        if profile.word_balance >= 2000:
            return

        offer = settings.auto_renew_offer
        
        # Check if user has enough balance
        if profile.acount_balance < offer.price:
            logger.warning(f"Auto-renew failed for {profile.user.email}: Insufficient balance ({profile.acount_balance} < {offer.price})")
            # Maybe send a notification here
            try:
                from chat.models import Notification
                Notification.objects.create(
                    user=profile.user,
                    message=f"Auto-renew failed for offer '{offer.name}' due to insufficient balance. Please top up your account.",
                    type='error'
                )
            except:
                pass
            return

        # Perform purchase
        with transaction.atomic():
            # Lock profile for update
            profile = Profile.objects.select_for_update().get(id=profile.id)
            
            # Re-check conditions after lock
            if profile.word_balance >= 2000 or profile.acount_balance < offer.price:
                return

            # Deduct balance
            profile.acount_balance -= offer.price
            profile.save()

            # Create Paid Payment
            # transaction_id='AUTO_RENEW' will distinguish it
            payment = Payment.objects.create(
                profile=profile,
                offer=offer,
                amount=offer.price,
                status='paid',
                transaction_id='AUTO_RENEW',
                payment_type='subscription',
                paid_at=timezone.now()
            )
            
            # The Payment.save() method (specifically the status transition to 'paid')
            # will automatically create the Subscription and call sync_word_balance().
            
            logger.info(f"Auto-renew successful for {profile.user.email}: Purchased '{offer.name}'")

    except Exception as e:
        logger.error(f"Auto-renew Error for {profile.user.email}: {e}")
