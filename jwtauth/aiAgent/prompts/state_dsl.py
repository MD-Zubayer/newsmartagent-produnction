"""
Order State & Memory DSL Builder
================================
Constructs the real-time order state machine and memory transition prompt.
Prevents instruction drift across all frontier models.
"""

from typing import List, Optional


def build_order_state_dsl(
    order_state: str,
    collected: List[str],
    missing: List[str],
    prefilled_fields: Optional[List[str]] = None,
    strike_lines: Optional[List[str]] = None,
    recent_product: Optional[str] = None,
    is_simple_greeting: bool = False,
    is_interruption: bool = False,
    recent_confirmed_order: Optional[dict] = None,
) -> str:
    """
    Build the universal Order Memory State DSL.
    
    Returns:
        Structured XML-Declarative DSL string.
    """
    collected_str = "; ".join(collected) if collected else "none"
    missing_str = ", ".join(missing) if missing else "none"
    strikes_str = "; ".join(strike_lines) if strike_lines else "none"

    directives = []

    if order_state == 'idle':
        if prefilled_fields:
            prefilled_str = ", ".join(prefilled_fields)
            directives.append(
                f'SAVED_PROFILE: Customer profile has saved details: [{prefilled_str}]. '
                'State is IDLE. Customer is browsing or asking questions. DO NOT push order collection, '
                'ask for missing fields, or create order drafts unless customer explicitly expresses intent to purchase.'
            )
        elif recent_product:
            directives.append(
                f'RECENT_INTEREST: Customer previously showed interest in "{recent_product}". '
                'State is IDLE. If customer confirms or explicitly expresses intent to order, transition to ordering.'
            )
        else:
            directives.append(
                'IDLE_STATE: Customer is browsing or inquiring. Respond to questions naturally; do not push order collection.'
            )
    elif prefilled_fields:
        prefilled_str = ", ".join(prefilled_fields)
        directives.append(
            f'PREFILLED_PROFILE: Customer profile memory has saved details: [{prefilled_str}]. '
            'Do NOT ask customer to re-enter them. Confirm if these saved details are correct, '
            f'and ask ONLY for truly missing fields: [{missing_str}].'
        )
    else:
        directives.append(
            f'SLOT_COLLECTION: Use collected fields as source of truth. '
            f'Ask ONLY for the next missing field: [{missing_str}].'
        )

    if is_simple_greeting:
        directives.append(
            'GREETING_OVERRIDE: Customer only greeted. Respond with a polite greeting only; do not push order collection.'
        )

    if order_state == 'awaiting_confirmation':
        directives.append(
            'AWAITING_CONFIRMATION: Wait strictly for user acceptance, edits, or cancellation. Do not finalize without confirmation.'
        )

    if is_interruption:
        directives.append(
            'INTERRUPTION: Customer asked a side question. Answer the question politely; suppress order forms in this reply.'
        )

    if recent_confirmed_order and isinstance(recent_confirmed_order, dict):
        o_id = recent_confirmed_order.get('order_id')
        o_prod = recent_confirmed_order.get('product_name')
        o_qty = recent_confirmed_order.get('item_quantity') or 1
        o_url = recent_confirmed_order.get('tracking_url') or ''
        directives.append(
            f'RECENT_CONFIRMED_ORDER: Customer has an already confirmed Order #{o_id} for "{o_prod}" (Quantity: {o_qty}). '
            'If customer now asks for "আরেকটা লাগবে" (I need another one) or additional items, recognize that Order #'
            f'{o_id} is already placed. Do NOT multiply or duplicate previous items into a larger count (e.g. do not turn 1 charger into 2 chargers unless customer explicitly says so). '
            f'Acknowledge Order #{o_id} and clearly ask if they want to add new item(s) to existing Order #{o_id} or make a new separate order. '
            'CRITICAL: If customer asks for their link again (e.g. "লিংকটা দেন", "আগের লিংকটা পাইতেছি না", "link please") or wants to CANCEL (বাতিল), EDIT ADDRESS (ঠিকানা পরিবর্তন), TRACK (ট্র্যাক), or RETURN (রিটার্ন) their confirmed Order #'
            f'{o_id}, DO NOT cancel or modify the database directly in chat. Politely provide their dedicated order page link'
            + (f': {o_url}' if o_url else '') + ' and explain that they can view live status, track delivery, or update/manage their order directly from this link.'
        )

    directives_str = "\n    - ".join(directives)

    dsl = (
        '<order_state_context version="2.0">\n'
        f'  CURRENT_STATE: {order_state or "idle"}\n'
        f'  COLLECTED_FIELDS: [{collected_str}]\n'
        f'  MISSING_FIELDS: [{missing_str}]\n'
        f'  FAILED_ATTEMPTS: [{strikes_str}]\n'
        '\n'
        '  <state_directives>\n'
        f'    - {directives_str}\n'
        '  </state_directives>\n'
        '</order_state_context>'
    )
    return dsl
