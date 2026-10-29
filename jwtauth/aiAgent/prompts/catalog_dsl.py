"""
AI Agent Catalog & Inventory Protocol DSL Builder
=================================================
Generates a structured, cross-model Domain Specific Language (DSL) ruleset for catalog discovery,
ongoing product focus, and multi-track product context.
Compatible with:
  - Google Gemini (1.5 / 2.0)
  - OpenAI GPT (GPT-4o / GPT-4o-mini / o1)
  - Anthropic Claude (Claude 3.5 Sonnet / Claude 3 Haiku)
  - xAI Grok (Grok 2 / Grok 3)
"""

import json
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger('aiAgent')


def build_catalog_dsl(
    active_inventory: Optional[str] = None,
    ongoing_product: Optional[Dict[str, Any]] = None,
    searched_product: Optional[Dict[str, Any]] = None,
    confidence: float = 0.0,
    is_list_selection: bool = False,
    active_promotions: Optional[list] = None,
    images_sent_product_ids: Optional[list] = None,
) -> str:
    """
    Build the universal Catalog & Multi-Track Product DSL.
    
    Args:
        active_inventory: Compact store category and product pricing summary string.
        ongoing_product: Serialized active conversation product dictionary from session memory.
        searched_product: Serialized query-matched product dictionary from live search.
        confidence: Match confidence score of searched_product.
        is_list_selection: True if customer chose an item number from a previously listed list.
        active_promotions: Optional list of active storewide promotions/campaigns.
        images_sent_product_ids: Product IDs whose images have already been delivered in this conversation session.
        
    Returns:
        Structured XML-Declarative DSL string.
    """
    dsl_parts = ['<catalog_context version="2.1">']

    images_sent = set(images_sent_product_ids or [])

    # 1. Store Active Inventory Anchor (~30-40 tokens)
    if active_inventory:
        dsl_parts.append(f'  <active_inventory>\n    {active_inventory}\n  </active_inventory>')

    # 1.5 Active Storewide Promotions / Campaigns (if configured)
    if active_promotions:
        dsl_parts.append(
            f'  <active_promotions>\n'
            f'    {json.dumps(active_promotions, ensure_ascii=False, default=str)}\n'
            f'  </active_promotions>'
        )

    # 2. Ongoing Product from Session Memory
    if ongoing_product:
        prod_id = ongoing_product.get("id") or ""
        prod_name = ongoing_product.get("name") or ""
        img_flag = ' has_images="true"' if ongoing_product.get("has_images") else ''
        sent_flag = f' images_already_sent="{"true" if prod_id in images_sent else "false"}"'
        dsl_parts.append(
            f'  <active_product id="{prod_id}" name="{prod_name}"{img_flag}{sent_flag}>\n'
            f'    {json.dumps(ongoing_product, ensure_ascii=False, default=str)}\n'
            f'  </active_product>'
        )

    # 3. Searched Product (if customer queried a specific or different item)
    if searched_product and (not ongoing_product or searched_product.get("id") != ongoing_product.get("id")):
        prod_id = searched_product.get("id") or ""
        prod_name = searched_product.get("name") or ""
        img_flag = ' has_images="true"' if searched_product.get("has_images") else ''
        sent_flag = f' images_already_sent="{"true" if prod_id in images_sent else "false"}"'
        dsl_parts.append(
            f'  <searched_product id="{prod_id}" name="{prod_name}" confidence="{confidence:.2f}"{img_flag}{sent_flag}>\n'
            f'    {json.dumps(searched_product, ensure_ascii=False, default=str)}\n'
            f'  </searched_product>'
        )

    # 4. Declarative Directives (Token-efficient, Cross-model)
    directives_list = []
    if is_list_selection:
        directives_list.append(
            '    - SELECTION_CONFIRMED: Customer chose this product from the previously listed options. '
            'Warmly present this selected product\'s features, price, and ask if they would like to know more or see photos. '
            'DO NOT treat the number as an order quantity or create an order draft.'
        )
    directives_list.extend([
        '    - FOLLOW_UP: Use active_product for ongoing product questions (price, offer/discount, battery, camera, stock, order).',
        '    - OFFERS_AND_DISCOUNTS: When a product has "has_offer": true (meaning offer_price < regular_price), ALWAYS highlight the offer/discount when the customer asks about offers, discounts, or price (e.g., regular price is regular_price, currently on offer at offer_price with discount_amount / discount_percentage% off). Also mention any applicable <active_promotions>. Never say there is no offer if has_offer is true!',
        '    - BROWSE: When customer asks what else is available or browses the store (e.g. "ki ki ponno ase apnar kase?"), warmly present options from active_inventory including each product\'s clear price or special offer price.',
        '    - SWITCH: Transition to searched_product when customer inquires about a new item.',
        '    - TONE: Natural conversational sales tone; keep replies concise, friendly, and human.',
        '    - FACT_INTEGRITY: Rely only on verified catalog facts. Never invent prices, stock, or specs.',
    ])

    directives_str = "\n".join(directives_list)
    dsl_parts.append(
        f'  <directives>\n{directives_str}\n  </directives>\n</catalog_context>'
    )

    return "\n".join(dsl_parts)
