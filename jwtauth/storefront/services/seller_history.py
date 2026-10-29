from django.db.models import F
from django.utils import timezone

from ..models import Customer, CustomerShopHistory


def remember_customer_shop(customer: Customer, merchant, *, increment_order=False):
    if not customer or not merchant:
        return None

    history, created = CustomerShopHistory.objects.get_or_create(
        customer=customer,
        merchant=merchant,
        defaults={'order_count': 1 if increment_order else 0},
    )
    if not created:
        updates = {'last_seen_at': timezone.now()}
        if increment_order:
            history.order_count = F('order_count') + 1
            updates['order_count'] = history.order_count
        CustomerShopHistory.objects.filter(pk=history.pk).update(**updates)
        history.refresh_from_db()
    return history
