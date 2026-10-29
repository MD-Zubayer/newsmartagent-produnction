"""
Response Classification & Output Schema DSL Builder
===================================================
Constructs the output formatting, intent classification, and schema enforcement prompt.
Guarantees deterministic JSON generation across Google Gemini, OpenAI GPT-4o, Anthropic Claude, and xAI Grok.
"""

from typing import Optional, Any


def build_classification_dsl(
    redis_cache_enabled: bool = False,
    settings_obj: Optional[Any] = None,
    has_image_support: bool = False,
    is_image_msg: bool = False,
) -> str:
    """
    Build the universal Response Classification & Output Schema DSL.
    
    Returns:
        Structured XML-Declarative DSL string.
    """
    # 1. Dynamic JSON Format Schema
    format_fields = [
        '"reply": "string (Conversational reply in matched customer language)"',
        '"human_handoff": "boolean (true ONLY if user explicitly requests human representative)"',
        '"order_intent": "enum[\'create\', \'confirm\', \'cancel\', \'interrupted\', null]"',
        '"order_data": "object or null (Contains product_name, price, customer details, items array)"',
    ]
    if redis_cache_enabled:
        format_fields.append('"cache_type": "enum[\'no_cache\', \'sender_specific\', \'agent_specific\', \'global\']"')
    if has_image_support:
        format_fields.append('"image_intent": "boolean (true when delivering photos)"')
        format_fields.append('"image_ids": "[integer] (List of row/product image IDs)"')
        format_fields.append('"image_style": "\'image_with_caption\'"')

    schema_str = ",\n    ".join(format_fields)

    # 2. Cache types description (if enabled)
    cache_section = ""
    if redis_cache_enabled and settings_obj:
        cache_types = ['  - "no_cache": Context-dependent references, greetings, affirmations, and denials.']
        if getattr(settings_obj, 'sender_cache_enabled', False):
            cache_types.append('  - "sender_specific": User-specific data (names, phone numbers, addresses, order status).')
        if getattr(settings_obj, 'agent_cache_enabled', False):
            cache_types.append('  - "agent_specific": Merchant catalog info, product specs, prices, and merchant identity.')
        if getattr(settings_obj, 'global_cache_enabled', False):
            cache_types.append('  - "global": General universal facts.')
        cache_desc = "\n    ".join(cache_types)
        cache_section = f"\n  <cache_policy>\n    {cache_desc}\n  </cache_policy>"

    # 3. Image delivery rules
    image_rules = ""
    if has_image_support:
        uploaded_image_rule = ""
        if is_image_msg:
            uploaded_image_rule = (
                "\n    - UPLOADED_IMAGE_HANDLING: Customer already uploaded a product image. "
                "Do NOT ask if they want to view it. Confirm availability and directly ask to order ('অর্ডার করতে চান?')."
            )
        image_rules = (
            "\n  <visual_delivery_rules>\n"
            "    - Set image_intent=true and fill image_ids if customer asks for photos or to view the product (e.g. 'ছবি পাঠান', 'ছবি দেন', 'দেখান তো', 'দেখতে পারি', 'ছবি আছে?', 'ছবি দাও'), OR when recommending products from catalog.\n"
            "    - NEVER output markdown image links like ![...](...) or url placeholders in 'reply'. The system delivers photos automatically when image_intent is true.\n"
            "    - NEVER claim you cannot show, send, attach, or upload images. System handles delivery automatically.\n"
            "    - Phrasing: Write a welcoming delivery phrase in 'reply' (e.g. 'অবশ্যই, নিচে ছবি দেওয়া হলো:'). NEVER say future tense 'আমি ছবি পাঠাচ্ছি' or 'ছবি পাঠাবো'."
            f"{uploaded_image_rule}\n"
            "  </visual_delivery_rules>"
        )

    dsl = (
        'Return ONLY a valid JSON object starting with "{" and ending with "}". Perfect JSON syntax is required. No markdown code fences, no preamble outside the JSON.\n'
        '<response_classification_dsl version="2.0">\n'
        '  OUTPUT_CONSTRAINT: STRICT_JSON_ONLY (Start with "{" and end with "}". No markdown code fences, no preamble outside the JSON)\n'
        '\n'
        '  <output_schema>\n'
        f'    {{\n    {schema_str}\n    }}\n'
        '  </output_schema>\n'
        f'{cache_section}'
        '\n  <intent_rules>\n'
        '    ORDER_INTENT:\n'
        '      - "create": Customer expresses interest in ordering, wants to buy/take product (e.g. "অর্ডার করতে চাই", "কিনতে চাই", "১টা দেন"), or provides order details.\n'
        '      - "confirm": Customer explicitly accepts or confirms draft order details in chat history.\n'
        '      - "cancel": Customer explicitly cancels an active ongoing order or draft (e.g. "অর্ডার বাতিল করুন", "অর্ডার লাগবে না", "ক্যান্সেল করুন").\n'
        '      - "interrupted": Customer asks a side question (delivery fee, office hours, policy) instead of confirming.\n'
        '      - null: Customer complaints, criticism, objections (e.g. "বাজে প্রোডাক্ট", "ঠকান আপনারা", "ভালো না"), non-order conversation, or general inquiry. Always respond empathetically in "reply".\n'
        '\n'
        '    ORDER_DATA:\n'
        '      - Always populate "order_data": {"product_name": "string or null"} tracking active product from conversation, even if order_intent is null.\n'
        '      - If discount/offer price exists in catalog, inform customer and set discount price in "order_data".\n'
        '      - Map raw visual descriptions back to authoritative catalog product name; never invent names or prices.\n'
        '  </intent_rules>'
        f'{image_rules}\n'
        '</response_classification_dsl>'
    )
    return dsl
