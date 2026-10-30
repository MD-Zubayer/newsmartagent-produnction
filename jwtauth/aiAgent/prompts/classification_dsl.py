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
        '"courier_check": "object or null (When customer mentions district/upazila/thana, set {\'district\': \'DistrictInEnglish\', \'upazila\': \'UpazilaInEnglish\', \'address\': \'raw address\'})"',
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
            "    - When images_already_sent='false' (in catalog context): Set image_intent=true and fill image_ids when introducing/recommending the product for the first time OR when customer asks for photos (e.g. 'ছবি পাঠান', 'ছবি দেন', 'দেখান তো', 'দেখতে পারি', 'ছবি আছে?', 'ছবি দাও').\n"
            "    - When images_already_sent='true': The customer already received the photos in this conversation. Set image_intent=false for all follow-up questions (quality, warranty, battery, pricing, or referencing previously sent photos like 'ছবিতে যেমন দেখছি তেমন পাবো তো?'). Set image_intent=true again ONLY if customer explicitly asks to see the photos again or if you recommend a different product whose images_already_sent is 'false'.\n"
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
        '      - "create": Customer expresses interest in placing an order, provides/updates order slot details, asks to view or check the order draft/status (e.g. "draft dekhan", "ড্রাফট দেখান", "আমার অর্ডারটা কি হলো?", "কি কি তথ্য দিয়েছি?"), OR whenever your own reply presents the order draft summary and asks the customer whether they want to confirm.\n'
        '      - "confirm": ONLY when the customer explicitly and purely confirms/accepts a previously shown draft (e.g. "হ্যাঁ", "হ", "ঠিক আছে", "কনফার্ম", "ok", "yes") to finalize the order immediately. NEVER set "confirm" if the customer is asking to see the draft ("draft dekhan"), asking about order status, providing/repeating address details, or if your own reply is asking a confirmation question ("আপনি কি অর্ডারটি কনফার্ম করতে চান?") — in all those cases, set order_intent="create".\n'
        '      - "cancel": Customer explicitly cancels an active ongoing order or draft (e.g. "অর্ডার বাতিল করুন", "অর্ডার লাগবে না", "ক্যান্সেল করুন").\n'
        '      - "interrupted": Customer asks a side question (delivery fee, office hours, policy) during active slot collection.\n'
        '      - null: Set order_intent=null when customer asks hesitant, conditional, quality, warranty, return policy, or authenticity questions (e.g. "নিতে তো চাই, কিন্তু কেমন হবে? নষ্ট হয়ে গেলে?", "ছবির মতো না হলে ফেরত দেওয়া যাবে?", "ভালো হবে তো?"), complaints, criticism, or general inquiry. Even if message contains "নিতে চাই" or "কিনবো", if it is conditional on quality/warranty, keep order_intent=null, address their question empathetically, and warmly ask if they would like to proceed with the order.\n'
        '\n'
        '    ORDER_DATA:\n'
        '      - Always populate "order_data": {"product_name": "string or null"} tracking active product from conversation, even if order_intent is null.\n'
        '      - When customer expresses a color, variant, or size preference while browsing (even when order_intent is null), capture it in "order_data": {"extra_info": "Color: Blue Black" (or selected attribute)}.\n'
        '      - If discount/offer price exists in catalog, inform customer and set discount price in "order_data".\n'
        '      - Map raw visual descriptions back to authoritative catalog product name; never invent names or prices.\n'
        '\n'
        '    COURIER_CHECK_INTENT:\n'
        '      - Whenever customer provides or updates address with district and/or upazila/thana (even in Bengali e.g. "ফরিদপুর ভাঙ্গা বটতলা"), populate "courier_check": {"district": "Faridpur", "upazila": "Bhanga", "address": "ফরিদপুর ভাঙ্গা বটতলা", "sub_area_hint": "বটতলা"}. The system invokes live courier coverage validation for these parameters.\n'
        '  </intent_rules>'
        f'{image_rules}\n'
        '</response_classification_dsl>'
    )
    return dsl
