import logging
import re
from django.db import transaction
from django.db.models import Q
from ..models import Customer, CustomerIdentity, CustomerAddress, CheckoutSession, CustomerShopHistory
from users.models import CustomerOrder
from aiAgent.models import Contact

logger = logging.getLogger(__name__)


def is_ephemeral_customer(customer: Customer) -> bool:
    """Return True if customer was auto-created from a platform link rather than Google OAuth."""
    if not customer:
        return False
    return str(customer.google_sub or '').startswith('instant_')


@transaction.atomic
def merge_customer_accounts(source_customer: Customer, target_customer: Customer) -> Customer:
    """
    Merge an ephemeral platform-created Customer account (`source_customer`) into a
    permanent Customer account (`target_customer`, e.g. after Google Sign-In).
    Transfers all platform identities, saved addresses, orders, checkout sessions,
    and shop history so the account is unified under `target_customer`.
    """
    if not source_customer or not target_customer or source_customer.id == target_customer.id:
        return target_customer

    try:
        # 1. Transfer platform identities
        for ident in CustomerIdentity.objects.filter(customer=source_customer):
            conflict = CustomerIdentity.objects.filter(
                platform=ident.platform,
                platform_user_id=ident.platform_user_id,
                agent=ident.agent,
            ).exclude(id=ident.id).first()
            if conflict:
                conflict.customer = target_customer
                conflict.save(update_fields=['customer', 'updated_at'])
                ident.delete()
            else:
                ident.customer = target_customer
                ident.save(update_fields=['customer', 'updated_at'])

        # 2. Transfer saved addresses
        has_default = CustomerAddress.objects.filter(customer=target_customer, is_default=True).exists()
        for addr in CustomerAddress.objects.filter(customer=source_customer):
            if has_default and addr.is_default:
                addr.is_default = False
            addr.customer = target_customer
            addr.save(update_fields=['customer', 'is_default', 'updated_at'])

        # 3. Transfer orders & checkout sessions
        CustomerOrder.objects.filter(customer=source_customer).update(customer=target_customer)
        CheckoutSession.objects.filter(customer=source_customer).update(customer=target_customer)

        # 4. Transfer shop visit/order history
        for hist in CustomerShopHistory.objects.filter(customer=source_customer):
            existing_hist = CustomerShopHistory.objects.filter(
                customer=target_customer, merchant=hist.merchant
            ).first()
            if existing_hist:
                existing_hist.order_count = existing_hist.order_count + hist.order_count
                existing_hist.save(update_fields=['order_count', 'last_seen_at'])
                hist.delete()
            else:
                hist.customer = target_customer
                hist.save(update_fields=['customer', 'last_seen_at'])

        # 5. Preserve phone number if target doesn't have one yet
        if source_customer.primary_phone and not target_customer.primary_phone:
            target_customer.primary_phone = source_customer.primary_phone
            target_customer.save(update_fields=['primary_phone', 'updated_at'])

        # 6. Delete ephemeral source account so no duplicate remains
        if is_ephemeral_customer(source_customer):
            logger.info(
                f"Merged ephemeral customer #{source_customer.id} ({source_customer.google_sub}) "
                f"into customer #{target_customer.id} ({target_customer.email})"
            )
            source_customer.delete()
    except Exception as e:
        logger.error(f"Error merging customer accounts ({source_customer.id} -> {target_customer.id}): {e}", exc_info=True)

    return target_customer


def resolve_or_create_customer_for_session(session: CheckoutSession, browser_customer: Customer = None) -> Customer:
    """
    Resolves or auto-creates a Customer account when opening a checkout link from any platform:
    1. If the platform Contact is already linked to a Customer (e.g. a Google-linked account), use it
       and merge any ephemeral browser/session customer into it.
    2. Otherwise if the browser already has an authenticated Customer, link this session/contact to it.
    3. Otherwise check session.customer or match by phone number.
    4. Otherwise auto-create a platform-scoped Customer (`instant_{platform}_{contact_id}`).
    """
    if not session:
        return browser_customer

    contact = session.contact
    contact_customer = get_customer_for_contact(contact) if contact else None
    session_customer = session.customer

    metadata = session.metadata if isinstance(session.metadata, dict) else {}
    metadata_phone = str(metadata.get("phone") or "").strip()
    contact_phone = str(getattr(contact, "phone", None) or getattr(contact, "identifier", None) or "").strip() if contact else ""
    candidate_phone = contact_phone or metadata_phone

    phone_customer = None
    if candidate_phone:
        phone_digits = re.sub(r"\D", "", candidate_phone)
        if len(phone_digits) >= 10:
            # Prefer a non-ephemeral (Google-linked) customer if one matches this phone
            phone_customer = (
                Customer.objects.filter(primary_phone__endswith=phone_digits[-10:])
                .exclude(google_sub__startswith='instant_')
                .first()
                or Customer.objects.filter(primary_phone__endswith=phone_digits[-10:]).first()
            )

    # Choose the most authoritative customer account (prefer Google-linked over ephemeral)
    candidates = [c for c in [contact_customer, browser_customer, session_customer, phone_customer] if c is not None]
    google_linked = next((c for c in candidates if not is_ephemeral_customer(c)), None)
    primary_customer = google_linked or (candidates[0] if candidates else None)

    if not primary_customer:
        platform = (session.source_platform or (contact.platform if contact else None) or "ai_link").lower()
        unique_sub = f"instant_{platform}_{contact.id if contact else session.code}"
        email_prefix = f"user_{(str(contact.id) if contact else session.code).lower()}"
        display_name = (
            metadata.get("customer_name")
            or (contact.name or contact.push_name if contact else None)
            or f"Customer #{session.code[:6]}"
        )
        primary_customer, _ = Customer.objects.get_or_create(
            google_sub=unique_sub,
            defaults={
                "email": f"{email_prefix}.{platform}@customer.newsmartagent.com",
                "name": display_name,
                "primary_phone": candidate_phone or None,
            }
        )

    # If both an ephemeral customer and a primary customer exist, merge the ephemeral one into primary
    for other in candidates:
        if other.id != primary_customer.id and is_ephemeral_customer(other):
            merge_customer_accounts(other, primary_customer)

    # Update customer name/phone from latest chat metadata if still generic
    updated_fields = []
    if metadata.get("customer_name") and (not primary_customer.name or primary_customer.name.startswith("Customer #")):
        primary_customer.name = str(metadata.get("customer_name")).strip()
        updated_fields.append("name")
    if candidate_phone and not primary_customer.primary_phone:
        primary_customer.primary_phone = candidate_phone
        updated_fields.append("primary_phone")
    if updated_fields:
        updated_fields.append("updated_at")
        primary_customer.save(update_fields=updated_fields)

    link_customer_to_checkout_session(primary_customer, session)
    return primary_customer


def link_contact_to_customer(customer: Customer, contact: Contact) -> CustomerIdentity:
    """
    Links an aiAgent.Contact to a Customer account.
    If the contact has a phone number / identifier, link platform and platform_user_id.
    """
    if not customer or not contact:
        return None

    platform = (contact.platform or 'unknown').lower()
    platform_user_id = contact.identifier
    agent = contact.agent

    identity, created = CustomerIdentity.objects.get_or_create(
        platform=platform,
        platform_user_id=platform_user_id,
        agent=agent,
        defaults={
            'customer': customer,
            'contact': contact,
            'display_name': contact.name or contact.push_name or ''
        }
    )

    if not created and identity.customer != customer:
        # Merge/transfer identity to new customer
        identity.customer = customer
        identity.contact = contact
        identity.save(update_fields=['customer', 'contact', 'updated_at'])

    # Backfill previous orders placed with this contact or phone
    backfill_orders_for_customer(customer, contact=contact)

    return identity


def link_customer_to_checkout_session(customer: Customer, session: CheckoutSession) -> int:
    """Attach an authenticated customer to a chat checkout session."""
    if not customer or not session:
        return 0

    session.customer = customer
    session.save(update_fields=["customer", "updated_at"])

    if session.contact:
        link_contact_to_customer(customer, session.contact)

    metadata = session.metadata if isinstance(session.metadata, dict) else {}
    phone = str(metadata.get("phone") or "").strip()
    if phone and not customer.primary_phone:
        customer.primary_phone = phone
        customer.save(update_fields=["primary_phone", "updated_at"])

    return backfill_orders_for_customer(
        customer, contact=session.contact, phone=phone or customer.primary_phone
    )


def backfill_orders_for_customer(customer: Customer, contact: Contact = None, phone: str = None) -> int:
    """
    Finds existing CustomerOrders matching the contact or phone number
    and associates them with this Customer account.
    Returns the count of backfilled orders.
    """
    filters = Q()

    if contact:
        # Match by contact foreign key or platform + source_contact_id
        filters |= Q(contact=contact)
        filters |= Q(source_platform=contact.platform.lower(), source_contact_id=contact.identifier)

    # Match by phone number if available
    phone_to_check = phone or customer.primary_phone
    if phone_to_check and len(phone_to_check.strip()) >= 10:
        clean_phone = phone_to_check.strip()
        # Handle +880 or leading 0 variations
        digits = clean_phone[-10:]
        filters |= Q(phone_number__endswith=digits)

    if not filters:
        return 0

    orders_to_update = CustomerOrder.objects.filter(filters, customer__isnull=True)
    count = orders_to_update.count()
    if count > 0:
        orders_to_update.update(customer=customer)
        logger.info(f"Backfilled {count} orders to customer {customer.email}")

    return count


def get_customer_for_contact(contact: Contact) -> Customer:
    """
    Given an aiAgent.Contact, returns the linked Customer if exists.
    """
    if not contact:
        return None
    try:
        identity = CustomerIdentity.objects.select_related('customer').get(
            platform=contact.platform.lower(),
            platform_user_id=contact.identifier,
            agent=contact.agent
        )
        return identity.customer
    except CustomerIdentity.DoesNotExist:
        return None
