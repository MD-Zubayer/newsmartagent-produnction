"""
Storefront Conversational UI Engine & AI-Driven Widget Orchestrator.

Instead of brittle keyword matching, the AI LLM itself decides which interactive UI templates
or system actions to trigger based on the full conversation context, customer profile, and user intent.
"""

import re
import logging
from courier.provider_registry import provider_specs_for_merchant
from .models import CustomerAddress, CheckoutSession
from .serializers import CustomerAddressSerializer
from datasheet.models import Product

logger = logging.getLogger(__name__)


# ─── 1. DEDICATED STOREFRONT AI PROMPT & TOOL/WIDGET ORCHESTRATION REGISTRY ──
# ─── 1. BALANCED STOREFRONT AI PROMPT & WIDGET ORCHESTRATION ─────────────────

STOREFRONT_PROMPT_TEMPLATES = {
    "base_system": (
        "Identity: You are the official Smart Storefront AI Assistant of '{shop_name}'.\n"
        "Role & Persona:\n{custom_role}\n\n"
        "CRITICAL CONVERSATIONAL STREAMING RULES:\n"
        "- Respond directly to the customer in natural, warm, polite conversational text (never output raw JSON or code blocks).\n"
        "- Keep responses concise, helpful, and easy to read.\n"
        "- Use accurate prices and facts from [LIVE SHOP PRODUCT CATALOG] and [KNOWLEDGE BASE DATA]. Never invent prices or policies."
    ),
    "ui_widget_decision_engine": (
        "[STOREFRONT UI WIDGET REGISTRY]:\n"
        "You control the Storefront Chat UI. When appropriate, attach at most ONE tag at the VERY END of your reply:\n"
        "- `[[WIDGET:delivery_inquiry]]` : Customer asks about delivery fee, shipping, or courier charge (ঢাকার ভেতরে ৳৭০, বাইরে ৳১৩০).\n"
        "- `[[WIDGET:address_form]]` : Customer wants to add, change, or submit their delivery address/location.\n"
        "- `[[WIDGET:product_showcase]]` : Customer asks to browse products, catalog, or see available items in stock.\n"
        "- `[[WIDGET:order_tracking]]` : Customer inquires about order status, parcel, courier update, or provides an ID/phone (use `[[WIDGET:order_tracking:<id_or_phone>]]` if ID/phone is mentioned; never confuse price or quantity with order IDs).\n"
        "- `[[ACTION:human_handoff]]` : Customer explicitly asks to talk to a human seller, agent, or owner.\n"
        "Guardrail: Output at most ONE tag placed strictly at the very end. For normal greetings, product details, or general Q&A, output NO tag."
    ),
}

# Regex to match complete tags like [[WIDGET:delivery_inquiry]] or [[WIDGET:order_tracking:1024]] or [[ACTION:human_handoff]]
CONTROL_TAG_REGEX = re.compile(r"\[\[\s*(WIDGET|ACTION)\s*:\s*([a-zA-Z0-9_]+)(?::([a-zA-Z0-9_#+\-]+))?\s*\]\]", re.IGNORECASE)


def build_storefront_engine_prompt_addon(customer=None) -> str:
    """
    Builds the AI Widget Decision Engine instructions with live customer context
    so the LLM knows whether the customer already has saved addresses.
    """
    saved_count = 0
    if customer:
        try:
            saved_count = CustomerAddress.objects.filter(customer=customer).count()
        except Exception:
            saved_count = 0
    return STOREFRONT_PROMPT_TEMPLATES["ui_widget_decision_engine"].format(
        saved_address_count=saved_count
    )


def extract_ai_control_tags(raw_text: str):
    """
    Extracts any AI-decided `[[WIDGET:...]]` and `[[ACTION:...]]` tags from the LLM response
    and returns `(clean_text, widget_keys, action_keys, params)`.
    """
    if not raw_text:
        return "", [], [], {}

    widget_keys = []
    action_keys = []
    params = {}

    for match in CONTROL_TAG_REGEX.finditer(raw_text):
        kind = match.group(1).upper()
        name = match.group(2).lower().strip()
        extra = match.group(3) if len(match.groups()) >= 3 and match.group(3) else ""
        if extra:
            params[name] = extra.strip()

        if kind == "WIDGET" and name not in widget_keys:
            widget_keys.append(name)
        elif kind == "ACTION" and name not in action_keys:
            action_keys.append(name)

    clean_text = CONTROL_TAG_REGEX.sub("", raw_text).strip()
    return clean_text, widget_keys, action_keys, params


# ─── 2. WIDGET PAYLOAD BUILDERS ──────────────────────────────────────────────

def _get_customer_saved_addresses(customer, visitor_id=None, merchant=None):
    """
    Fetches saved addresses for an authenticated Customer.
    """
    if customer:
        addrs = CustomerAddress.objects.filter(customer=customer).order_by('-is_default', '-created_at')[:6]
        return CustomerAddressSerializer(addrs, many=True).data
    return []


def build_delivery_inquiry_widget(merchant, customer=None, visitor_id=None, user_text=""):
    """
    Builds the interactive widget payload when AI decides `delivery_inquiry`:
    - Includes saved addresses (if any) + active courier provider hierarchy (Pathao / Steadfast).
    - Automatically performs live delivery calculation for the customer's location
      (from user_text, saved address, or default) and embeds `initial_quote`.
    """
    saved_addresses = _get_customer_saved_addresses(customer, visitor_id=visitor_id, merchant=merchant)
    providers = provider_specs_for_merchant(merchant) if merchant else []
    session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first() if merchant else None

    # Auto-resolve target location from user_text or first saved address
    target_district = None
    target_upazila = None
    courier_ids = {}
    target_address_str = ""

    from .services.address_suggest import resolve_courier_mapping_for_address
    from .services.delivery_quote import calculate_delivery_charge

    if user_text:
        try:
            mapping = resolve_courier_mapping_for_address(user_text)
            if mapping:
                target_district = mapping.get('district')
                target_upazila = mapping.get('upazila')
                target_address_str = f"{target_upazila}, {target_district}" if target_upazila else target_district
                courier_ids = mapping.get('courier_location_ids') or {}
        except Exception as e:
            logger.debug(f"Error mapping user_text to location: {e}")

    if not target_district and saved_addresses:
        first_addr = saved_addresses[0]
        target_district = first_addr.get('district')
        target_upazila = first_addr.get('upazila')
        target_address_str = first_addr.get('full_address') or f"{target_upazila}, {target_district}"
        courier_ids = first_addr.get('courier_location_ids') or {}

    if not target_district:
        target_district = 'Dhaka'
        target_address_str = 'ঢাকা (ঢাকার ভেতরে)'

    # Calculate live delivery quote immediately
    initial_quote = None
    try:
        quote = calculate_delivery_charge(
            merchant=merchant,
            district=target_district,
            courier_ids=courier_ids,
            item_weight=0.5,
        )
        initial_quote = {
            "widget_type": "live_delivery_quote_card",
            "delivery_charge": float(quote.get("delivery_charge", 70)),
            "estimated_days": quote.get("estimated_days", "১-৩ দিন"),
            "courier_provider": quote.get("courier_provider", "Standard Courier"),
            "region": quote.get("region") or target_district,
            "address": {
                "district": target_district,
                "upazila": target_upazila or "",
                "full_address": target_address_str,
            },
            "session_code": session.code if session else "",
        }
    except Exception as e:
        logger.warning(f"Error calculating initial live quote: {e}")

    return {
        "widget_type": "delivery_inquiry_template",
        "merchant_id": merchant.id if merchant else None,
        "session_code": session.code if session else "",
        "saved_addresses": saved_addresses,
        "has_saved_addresses": len(saved_addresses) > 0,
        "courier_providers": providers,
        "initial_quote": initial_quote,
        "default_customer": {
            "name": customer.name if customer else "",
            "phone": customer.primary_phone if customer else "",
        },
    }


def build_address_form_widget(merchant, customer=None):
    """
    Builds the Checkout-style interactive address form widget with dynamic courier provider hierarchy.
    """
    providers = provider_specs_for_merchant(merchant) if merchant else []
    session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first() if merchant else None
    return {
        "widget_type": "checkout_address_form_template",
        "merchant_id": merchant.id if merchant else None,
        "session_code": session.code if session else "",
        "courier_providers": providers,
        "default_customer": {
            "name": customer.name if customer else "",
            "phone": customer.primary_phone if customer else "",
        },
    }


def build_product_showcase_widget(merchant, user_text=""):
    """
    Builds interactive product cards for the chat timeline.
    """
    if not merchant:
        return None
    qs = Product.objects.filter(user=merchant, status='active', is_archived=False).prefetch_related('gallery').order_by('-id')[:6]
    if not qs.exists():
        return None

    session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first()
    items = []
    for p in qs:
        price = p.sale_price if p.sale_price is not None else p.base_price
        img_url = ""
        if p.gallery_images and isinstance(p.gallery_images, list) and p.gallery_images[0]:
            img_url = p.gallery_images[0]
        if not img_url:
            gal = p.gallery.filter(image__isnull=False).first()
            if gal and gal.image:
                try:
                    img_url = gal.image.url
                except Exception:
                    img_url = ""
        items.append({
            "id": p.id,
            "name": p.name,
            "price": float(price or 0),
            "base_price": float(p.base_price or 0),
            "image_url": img_url,
            "stock": getattr(p, 'stock_quantity', 10),
        })

    return {
        "widget_type": "product_showcase_template",
        "merchant_id": merchant.id,
        "session_code": session.code if session else "",
        "products": items,
    }


def build_product_detail_widget(merchant, product_id):
    """
    Builds a rich, interactive product card widget for a specific product.
    Supports photo gallery, variants/specs, stock status, and direct Buy Now / Add to Cart.
    """
    if not merchant or not product_id:
        return None
    try:
        p = Product.objects.filter(user=merchant, id=product_id, status='active', is_archived=False).prefetch_related('gallery', 'variants').first()
        if not p:
            return None

        price = p.sale_price if p.sale_price is not None else p.base_price
        images = []
        if p.gallery_images and isinstance(p.gallery_images, list):
            images = [img for img in p.gallery_images if img]
        if not images:
            for gal in p.gallery.filter(image__isnull=False):
                try:
                    if gal.image:
                        images.append(gal.image.url)
                except Exception:
                    pass

        session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first()
        variants_data = []
        for v in p.variants.all():
            variants_data.append({
                "id": v.id,
                "name": v.name or "",
                "attributes": v.attributes or {},
                "price": float(v.sale_price if v.sale_price is not None else (v.base_price or price or 0)),
                "stock": getattr(v, 'stock_quantity', 10),
            })

        return {
            "widget_type": "product_detail_card",
            "merchant_id": merchant.id,
            "session_code": session.code if session else "",
            "product": {
                "id": p.id,
                "name": p.name,
                "price": float(price or 0),
                "base_price": float(p.base_price or 0),
                "discount": round(float((p.base_price - price) / p.base_price * 100)) if (p.base_price and price and p.base_price > price) else 0,
                "images": images,
                "image_url": images[0] if images else "",
                "description": (p.description or "")[:200],
                "stock": getattr(p, 'stock_quantity', 10),
                "variants": variants_data,
                "attributes": p.attributes if isinstance(p.attributes, dict) else {},
                "warranty": getattr(p, 'warranty_information', '') or '',
            }
        }
    except Exception as e:
        logger.warning(f"Error building product detail widget for {product_id}: {e}")
        return None


def build_order_tracking_widget(merchant, customer=None, visitor_id=None, user_text="", orders=None, target_identifier=None):
    """
    Builds the interactive Order Tracking card payload for the chat timeline.
    Provides live order status, courier info, and direct link to the order tracking page.
    When the AI decision engine identifies a specific order ID or phone (target_identifier),
    it retrieves that exact order without relying on brittle regex matching.
    """
    BANGLA_STATUS_MAP = {
        'pending': 'পেন্ডিং (যাচাই চলছে)',
        'confirmed': 'কনফার্মড (প্যাকিং হচ্ছে)',
        'shipped': 'শিপড (কুরিয়ারে আছে)',
        'delivered': 'ডেলিভার্ড (সম্পন্ন)',
        'cancelled': 'বাতিল করা হয়েছে',
        'returned': 'রিটার্ন করা হয়েছে',
    }

    orders_list = []
    try:
        from storefront.services.tracking import build_order_tracking_timeline
        from users.models import CustomerOrder
        from django.db.models import Q

        if orders is not None:
            orders_qs = orders
        else:
            orders_qs = []
            clean_target = (target_identifier or "").strip().lstrip('#')

            # 1. If AI explicitly determined an order ID or phone number
            if clean_target and merchant:
                if clean_target.isdigit() and len(clean_target) <= 8:
                    orders_qs = CustomerOrder.objects.filter(user=merchant, id=int(clean_target))
                elif clean_target.isdigit() and len(clean_target) >= 10:
                    orders_qs = CustomerOrder.objects.filter(user=merchant, phone_number__endswith=clean_target[-10:])
                else:
                    try:
                        orders_qs = CustomerOrder.objects.filter(user=merchant, public_id=clean_target)
                    except Exception:
                        orders_qs = []

            # 2. If no specific target was requested by AI, use customer's session/profile orders
            if not orders_qs and merchant:
                q_filter = Q()
                if customer:
                    q_filter |= Q(customer=customer)
                    if getattr(customer, 'primary_phone', None):
                        q_filter |= Q(phone_number__endswith=customer.primary_phone[-10:])
                if visitor_id:
                    q_filter |= Q(source_contact_id__iexact=visitor_id)

                if q_filter:
                    orders_qs = CustomerOrder.objects.filter(user=merchant).filter(q_filter).distinct().order_by('-created_at')[:3]
                elif customer:
                    orders_qs = CustomerOrder.objects.filter(customer=customer).order_by('-created_at')[:3]

        for o in orders_qs:
            courier_name = o.courier or ""
            consignment_id = ""
            try:
                timeline_data = build_order_tracking_timeline(o)
                courier_name = timeline_data.get('courier_name') or courier_name
                consignment_id = timeline_data.get('consignment_id') or ""
            except Exception:
                pass

            orders_list.append({
                "id": o.id,
                "public_id": str(o.public_id),
                "status": o.status,
                "status_bangla": BANGLA_STATUS_MAP.get(o.status, o.status),
                "product_name": o.product_name or (o.items[0].get('name') if o.items and isinstance(o.items, list) and len(o.items) > 0 and isinstance(o.items[0], dict) else "অর্ডারকৃত পণ্য"),
                "total_price": float(o.price + (o.delivery_charge or 0)),
                "courier": courier_name,
                "consignment_id": consignment_id,
                "created_at": o.created_at.strftime('%d %b, %Y') if o.created_at else "",
                "tracking_url": f"/orders/{o.public_id}",
            })
    except Exception as e:
        logger.warning(f"Error building order tracking widget: {e}")

    return {
        "widget_type": "order_tracking_card",
        "merchant_id": merchant.id if merchant else None,
        "has_orders": len(orders_list) > 0,
        "orders": orders_list,
    }


def resolve_widgets_and_prompt_addons(merchant, customer, visitor_id, message_text="", attached_product_id=None):
    """
    Orchestrates prompt addons and interactive widgets based on:
    1. Direct customer product attachment (drag-and-drop or picker)
    2. Message content intent (delivery calculation, address, catalog, order inquiry)
    """
    prompt_addons = [build_storefront_engine_prompt_addon(customer=customer)]
    widgets = []

    # 1. If customer dragged/attached a specific product
    if attached_product_id:
        pw = build_product_detail_widget(merchant, attached_product_id)
        if pw:
            widgets.append(pw)
            p_obj = pw.get("product") or {}
            prompt_addons.append(
                f"[CUSTOMER ATTACHED PRODUCT IN CHAT]:\n"
                f"- Name: {p_obj.get('name')}\n"
                f"- Price: ৳{p_obj.get('price')} (Original: ৳{p_obj.get('base_price')})\n"
                f"- Stock: {p_obj.get('stock')}\n"
                f"- Description: {p_obj.get('description')}\n"
                f"The customer is asking specifically about this product. Answer their questions accurately and politely."
            )

    # 2. Heuristic fast triggers
    lower = (message_text or '').lower()
    delivery_words = ['delivery charge', 'delivery fee', 'shipping', 'kuriar', 'courier', 'charge koto', 'ভাড়া কত', 'চার্জ কত', 'ডেলিভারি']
    if any(w in lower for w in delivery_words):
        if not any(w.get("widget_type") == "delivery_inquiry_template" for w in widgets):
            widgets.append(build_delivery_inquiry_widget(merchant, customer=customer, visitor_id=visitor_id))

    showcase_words = ['সব প্রোডাক্ট', 'প্রোডাক্ট দেখান', 'পণ্য দেখান', 'ক্যাটালগ', 'stock ache', 'স্টক আছে', 'show product', 'all product']
    if any(w in lower for w in showcase_words):
        if not any(w.get("widget_type") == "product_showcase_template" for w in widgets):
            sw = build_product_showcase_widget(merchant, user_text=message_text)
            if sw:
                widgets.append(sw)

    order_words = ['order update', 'order status', 'অর্ডার আপডেট', 'অর্ডার স্ট্যাটাস', 'অর্ডার ট্র্যাক', 'পার্সেল কোথায়', 'কুরিয়ার স্ট্যাটাস', 'order track', 'tracking', 'কখন পাব', 'কবে পাব', 'অর্ডার টা কি পাঠানো হয়েছে', 'আমার অর্ডার']
    if any(w in lower for w in order_words):
        if not any(w.get("widget_type") == "order_tracking_card" for w in widgets):
            ow = build_order_tracking_widget(merchant, customer=customer, visitor_id=visitor_id, user_text=message_text)
            if ow:
                widgets.append(ow)

    return "\n\n".join(prompt_addons), widgets


def build_widgets_from_ai_decisions(merchant, customer, visitor_id, widget_keys, user_text="", widget_params=None):
    """
    Given the list of `widget_keys` and optional parameters decided by the AI LLM,
    builds the corresponding structured UI widget payloads for the frontend `ChatWidgetRenderer`.
    """
    widgets = []
    params = widget_params or {}
    for key in widget_keys:
        if key == "delivery_inquiry":
            widgets.append(build_delivery_inquiry_widget(merchant, customer=customer, visitor_id=visitor_id, user_text=user_text))
        elif key == "address_form":
            widgets.append(build_address_form_widget(merchant, customer=customer))
        elif key == "product_showcase":
            w = build_product_showcase_widget(merchant, user_text=user_text)
            if w:
                widgets.append(w)
        elif key == "order_tracking":
            target_id = params.get("order_tracking")
            w = build_order_tracking_widget(
                merchant, customer=customer, visitor_id=visitor_id, user_text=user_text, target_identifier=target_id
            )
            if w:
                widgets.append(w)
    return widgets
