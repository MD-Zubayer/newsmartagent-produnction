import logging
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q
from storefront.models import StorefrontPromotion

logger = logging.getLogger(__name__)


def get_active_promotions_for_merchant(merchant):
    """
    Returns a queryset of currently valid, active promotions for a merchant.
    Takes into account is_active, start_date, end_date, and usage limits.
    """
    if not merchant:
        return StorefrontPromotion.objects.none()

    now = timezone.now()
    qs = StorefrontPromotion.objects.filter(
        merchant=merchant,
        is_active=True,
    ).filter(
        Q(start_date__isnull=True) | Q(start_date__lte=now)
    ).filter(
        Q(end_date__isnull=True) | Q(end_date__gte=now)
    )

    # Filter out promotions that exceeded max_total_usage
    valid_promos = []
    for promo in qs:
        if promo.max_total_usage is not None and promo.times_used >= promo.max_total_usage:
            continue
        valid_promos.append(promo)

    return valid_promos


def evaluate_order_promotions(
    merchant,
    subtotal: float = 0.0,
    item_count: int = 1,
    district: str = '',
    coupon_code: str = '',
    items: list = None
) -> dict:
    """
    Evaluates active merchant promotions against cart/order parameters.
    Returns:
    - is_free_shipping: bool
    - free_shipping_reason: str
    - remaining_for_free_shipping: float or None
    - free_shipping_threshold: float or None
    - discount_amount: Decimal
    - applied_promotions: list of dicts
    - coupon_result: dict
    """
    subtotal = float(subtotal or 0.0)
    item_count = int(item_count or 1)
    district_clean = (district or '').strip().lower()
    coupon_clean = (coupon_code or '').strip().upper()

    active_promos = get_active_promotions_for_merchant(merchant)

    is_free_shipping = False
    free_shipping_reason = ""
    free_shipping_threshold = None
    remaining_for_free_shipping = None
    applied_promotions = []
    total_discount = Decimal('0.00')

    coupon_result = {
        "provided_code": coupon_clean,
        "is_valid": False,
        "message": ""
    }

    # 1. Search for Free Shipping Thresholds
    fs_promos = [p for p in active_promos if p.is_free_shipping or p.promotion_type == 'free_shipping']
    for p in fs_promos:
        # Check district eligibility if specified
        if p.applicable_districts and isinstance(p.applicable_districts, list) and len(p.applicable_districts) > 0:
            match_district = any(d.strip().lower() in district_clean for d in p.applicable_districts if d)
            if not match_district and district_clean:
                continue

        thresh = float(p.min_order_amount or 0.0)
        req_qty = int(p.min_quantity or 1)

        if thresh > 0:
            if free_shipping_threshold is None or thresh < free_shipping_threshold:
                free_shipping_threshold = thresh

            if subtotal >= thresh and item_count >= req_qty:
                is_free_shipping = True
                free_shipping_reason = f"ফ্রি ডেলিভারি অফার: {p.title}"
                applied_promotions.append({
                    "id": p.id,
                    "title": p.title,
                    "type": "free_shipping",
                    "benefit": "ডেলিভারি সম্পূর্ণ ফ্রি"
                })
            else:
                rem = max(0.0, thresh - subtotal)
                if remaining_for_free_shipping is None or rem < remaining_for_free_shipping:
                    remaining_for_free_shipping = round(rem, 2)
        elif p.is_free_shipping and item_count >= req_qty:
            # Flat free shipping offer without minimum amount
            is_free_shipping = True
            free_shipping_reason = f"ফ্রি ডেলিভারি: {p.title}"
            applied_promotions.append({
                "id": p.id,
                "title": p.title,
                "type": "free_shipping",
                "benefit": "ডেলিভারি সম্পূর্ণ ফ্রি"
            })

    # 2. Evaluate Coupon Code if provided
    if coupon_clean:
        matching_coupon = next((p for p in active_promos if (p.coupon_code or '').strip().upper() == coupon_clean), None)
        if matching_coupon:
            min_amt = float(matching_coupon.min_order_amount or 0.0)
            if subtotal < min_amt:
                coupon_result = {
                    "provided_code": coupon_clean,
                    "is_valid": False,
                    "message": f"এই কুপনটি ব্যবহারের জন্য ন্যূনতম ৳{int(min_amt)} টাকার অর্ডার প্রয়োজন।"
                }
            else:
                disc = Decimal('0.00')
                if matching_coupon.discount_percentage > 0:
                    pct = float(matching_coupon.discount_percentage) / 100.0
                    disc = Decimal(str(round(subtotal * pct, 2)))
                elif matching_coupon.discount_amount > 0:
                    disc = matching_coupon.discount_amount

                if matching_coupon.is_free_shipping:
                    is_free_shipping = True
                    free_shipping_reason = f"কুপন ফ্রি ডেলিভারি: {coupon_clean}"

                total_discount += disc
                coupon_result = {
                    "provided_code": coupon_clean,
                    "is_valid": True,
                    "discount_amount": float(disc),
                    "title": matching_coupon.title,
                    "message": f"কুপন '{coupon_clean}' সফলভাবে যুক্ত হয়েছে! (ছাড়: ৳{int(disc)})"
                }
                applied_promotions.append({
                    "id": matching_coupon.id,
                    "title": matching_coupon.title,
                    "type": "coupon_discount",
                    "code": coupon_clean,
                    "discount_amount": float(disc)
                })
        else:
            coupon_result = {
                "provided_code": coupon_clean,
                "is_valid": False,
                "message": "দুঃখিত, কুপন কোডটি সঠিক নয় বা এর মেয়াদ শেষ হয়ে গেছে।"
            }

    # 3. Automatic Cart Percentage or Fixed Discounts (Non-coupon based campaigns)
    auto_promos = [p for p in active_promos if not p.coupon_code and p.promotion_type in ('percentage_discount', 'fixed_discount', 'buy_x_get_y')]
    for p in auto_promos:
        min_amt = float(p.min_order_amount or 0.0)
        req_qty = int(p.min_quantity or 1)

        if subtotal >= min_amt and item_count >= req_qty:
            disc = Decimal('0.00')
            if p.discount_percentage > 0:
                pct = float(p.discount_percentage) / 100.0
                disc = Decimal(str(round(subtotal * pct, 2)))
            elif p.discount_amount > 0:
                disc = p.discount_amount

            if disc > 0:
                total_discount += disc
                applied_promotions.append({
                    "id": p.id,
                    "title": p.title,
                    "type": p.promotion_type,
                    "discount_amount": float(disc)
                })

    return {
        "is_free_shipping": is_free_shipping,
        "free_shipping_reason": free_shipping_reason,
        "free_shipping_threshold": free_shipping_threshold,
        "remaining_for_free_shipping": remaining_for_free_shipping if (remaining_for_free_shipping and not is_free_shipping) else None,
        "total_discount": total_discount,
        "applied_promotions": applied_promotions,
        "coupon_result": coupon_result,
        "active_promotions_count": len(active_promos),
    }


def build_ai_promotions_instruction_context(merchant) -> str:
    """
    Builds a structured ground-truth context block of live active promotions
    to inject into the AI system prompt.
    This guarantees the AI NEVER hallucinates or promises expired/non-existent offers.
    """
    if not merchant:
        return ""

    active_promos = get_active_promotions_for_merchant(merchant)
    if not active_promos:
        return "[ACTIVE STORE OFFERS & PROMOTIONS]: Currently no special storewide promotions are active. State regular product prices and live delivery rates accurately. Do not invent any offers."

    lines = ["[LIVE STORE OFFERS & PROMOTIONS (GROUND TRUTH - NEVER INVENT OTHERS)]:\n"]
    for p in active_promos:
        promo_info = f"- Campaign: '{p.title}'"
        details = []

        if p.is_free_shipping or p.promotion_type == 'free_shipping':
            if p.min_order_amount > 0:
                details.append(f"FREE DELIVERY on orders of ৳{int(p.min_order_amount)}+")
            else:
                details.append("FREE DELIVERY on all orders")

        if p.discount_percentage > 0:
            details.append(f"{p.discount_percentage}% discount")
        elif p.discount_amount > 0:
            details.append(f"৳{int(p.discount_amount)} flat discount")

        if p.coupon_code:
            details.append(f"Coupon Code: '{p.coupon_code}'")

        if p.min_quantity > 1:
            details.append(f"Min Quantity: {p.min_quantity} items")

        if p.applicable_districts and isinstance(p.applicable_districts, list) and len(p.applicable_districts) > 0:
            details.append(f"Valid only in: {', '.join(p.applicable_districts)}")

        if p.end_date:
            details.append(f"Expires on: {p.end_date.strftime('%d %b %Y, %I:%M %p')}")

        lines.append(f"{promo_info} -> {'; '.join(details)}")

    lines.append("\nINSTRUCTION FOR ASSISTANT:")
    lines.append("1. If the customer asks about delivery charge, discounts, or offers, communicate the above live promotions accurately in natural polite Bengali.")
    lines.append("2. Proactive Upselling: If a customer has a product in mind and reaching the Free Delivery threshold (e.g. ৳1,000) only requires a little more, politely suggest adding an item: e.g. 'আর মাত্র ৳... টাকার পণ্য যোগ করলেই ডেলিভারি চার্জ সম্পূর্ণ ফ্রি!'")
    lines.append("3. Strict Honesty: Never promise any discount, coupon, or free shipping condition that is not listed in the live ground truth above.")

    return "\n".join(lines)
