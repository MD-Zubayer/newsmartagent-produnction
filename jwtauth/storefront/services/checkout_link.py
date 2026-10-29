import os
import logging
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.utils import timezone

from ..models import CheckoutSession, generate_short_code
from aiAgent.models import Contact, AgentAI

logger = logging.getLogger(__name__)


def get_shop_base_url() -> str:
    shop_domain = os.environ.get('SHOP_DOMAIN') or getattr(settings, 'SHOP_DOMAIN', 'shop.newsmartagent.com')
    return f"https://{shop_domain}"


def create_checkout_session(
    merchant,
    agent: AgentAI = None,
    contact: Contact = None,
    items: list = None,
    delivery_charge: Decimal = Decimal('0.00'),
    source_platform: str = None,
    expires_in_hours: int = 72,
    metadata: dict = None
) -> CheckoutSession:
    """
    Creates a new CheckoutSession with short code and 72-hour validity.
    """
    items = items or []
    subtotal = Decimal('0.00')
    for itm in items:
        qty = int(itm.get('quantity', 1))
        price = Decimal(str(itm.get('price', 0)))
        p_name = itm.get('name', '').strip()
        if (price <= 0 or not itm.get('image_url')) and p_name and merchant:
            try:
                from datasheet.models import Product
                prod = Product.objects.filter(user=merchant, name__iexact=p_name).first()
                if not prod:
                    prod = Product.objects.filter(user=merchant, name__icontains=p_name[:20]).first()
                if prod:
                    if price <= 0:
                        price = prod.sale_price or prod.base_price or Decimal('0.00')
                        itm['price'] = float(price)
                    if not itm.get('image_url'):
                        if prod.gallery_images and isinstance(prod.gallery_images, list) and len(prod.gallery_images) > 0:
                            itm['image_url'] = prod.gallery_images[0]
                        if not itm.get('image_url'):
                            gal = prod.gallery.filter(image__isnull=False).first()
                            if gal and gal.image:
                                itm['image_url'] = gal.image.url
                        if not itm.get('image_url'):
                            link = prod.image_asset_links.select_related('asset').first()
                            if link and link.asset and link.asset.image:
                                itm['image_url'] = link.asset.image.url
            except Exception:
                pass
        subtotal += price * qty

    total = subtotal + Decimal(str(delivery_charge))
    expires_at = timezone.now() + timedelta(hours=expires_in_hours)

    platform = source_platform
    if not platform and contact:
        platform = contact.platform

    code = generate_short_code()
    # Ensure uniqueness
    while CheckoutSession.objects.filter(code=code).exists():
        code = generate_short_code()

    session = CheckoutSession.objects.create(
        code=code,
        merchant=merchant,
        agent=agent,
        contact=contact,
        items=items,
        subtotal=subtotal,
        delivery_charge=delivery_charge,
        total_price=total,
        source_platform=platform,
        expires_at=expires_at,
        metadata=metadata or {}
    )
    return session


def get_checkout_url(session: CheckoutSession) -> str:
    base = get_shop_base_url()
    return f"{base}/checkout/{session.code}"


def format_platform_checkout_message(session: CheckoutSession, platform: str = None) -> dict:
    """
    Formats the checkout invitation for the target platform:
    - Baileys (WhatsApp): Rich link text designed for WhatsApp preview card
    - Messenger / Facebook: Web URL button template payload (opens in in-app webview)
    - Telegram: Inline keyboard URL button
    - Default: Text link
    """
    url = get_checkout_url(session)
    target_platform = (platform or session.source_platform or 'other').lower()

    # Generate item summary for the message
    item_lines = []
    for itm in session.items:
        name = itm.get('name', 'Product')
        qty = itm.get('quantity', 1)
        price = itm.get('price', 0)
        item_lines.append(f"• {name} x{qty} - ৳{price}")
    item_text = "\n".join(item_lines) if item_lines else "• নির্বাচিত পণ্য"

    if target_platform == 'whatsapp':
        # Baileys / WhatsApp: text containing the URL at the end so WhatsApp renders the rich OG preview card
        text = (
            f"🛒 আপনার অর্ডারটি সম্পন্ন করতে নিচের লিঙ্কে ট্যাপ করুন:\n\n"
            f"{item_text}\n\n"
            f"মোট: ৳{session.total_price}\n\n"
            f"👉 এক ক্লিকে ঠিকানা দিয়ে অর্ডার কনফার্ম করুন:\n{url}"
        )
        return {
            "type": "text",
            "text": text,
            "url": url,
            "preview_url": True
        }

    elif target_platform in ('messenger', 'facebook'):
        return {
            "type": "template",
            "template_type": "button",
            "text": f"🛒 আপনার অর্ডার:\n{item_text}\nমোট: ৳{session.total_price}",
            "buttons": [
                {
                    "type": "web_url",
                    "url": url,
                    "title": "🛒 অর্ডার কনফার্ম করুন",
                    "webview_height_ratio": "full",
                    "messenger_extensions": False
                }
            ],
            "url": url
        }

    elif target_platform == 'telegram':
        return {
            "type": "text_with_inline_keyboard",
            "text": f"🛒 <b>আপনার অর্ডার</b>\n{item_text}\n<b>মোট:</b> ৳{session.total_price}\n\nঅর্ডারটি কনফার্ম করতে নিচের বাটনে চাপ দিন:",
            "inline_keyboard": [
                [{"text": "🛒 অর্ডার কনফার্ম করুন", "url": url}]
            ],
            "url": url
        }

    else:
        text = (
            f"🛒 আপনার অর্ডারটি সম্পন্ন করতে লিঙ্কে ক্লিক করুন:\n"
            f"{item_text}\nমোট: ৳{session.total_price}\n\n{url}"
        )
        return {
            "type": "text",
            "text": text,
            "url": url
        }
