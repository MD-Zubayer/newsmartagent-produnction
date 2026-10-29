import json
import logging
import time
import uuid
from decimal import Decimal
from time import monotonic

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from aiAgent.business_logic.logic_handler import (
    _language_mirroring_instruction,
    check_token_availability,
    deduct_user_tokens,
    log_token_usage,
    perform_rag_search,
)
from aiAgent.memory_handler import handle_smart_memory_update
from aiAgent.models import AgentAI, Contact, UserMemory
from aiAgent.utils import count_openai_tokens, get_memory_context
from chat.models import Conversation, Message
from chat.services import get_last_message, get_or_create_conversation, save_message
from datasheet.models import Product
from users.models import CustomerOrder
from webhooks.tasks import send_cache_update_ws, send_human_handoff_ws

from .auth import CustomerJWTAuthentication
from .chat_engine import (
    STOREFRONT_PROMPT_TEMPLATES,
    build_address_form_widget,
    build_delivery_inquiry_widget,
    build_order_tracking_widget,
    build_product_detail_widget,
    build_product_showcase_widget,
    build_storefront_engine_prompt_addon,
    build_widgets_from_ai_decisions,
    extract_ai_control_tags,
)
from .models import CheckoutSession, Customer, CustomerAddress, CustomerIdentity, CustomerShopHistory
from .serializers import CustomerAddressSerializer
from .services.address_suggest import resolve_courier_mapping_for_address
from .services.delivery_quote import calculate_delivery_charge
from .services.identity import link_contact_to_customer
from .services.seller_history import remember_customer_shop

logger = logging.getLogger(__name__)


def _merchant_display_info(merchant):
    profile = getattr(merchant, 'profile', None)
    shop_name = getattr(profile, 'shop_name', None) or merchant.name or merchant.email.split('@')[0]
    avatar_url = f"/api/storefront/v1/merchant-avatar/{merchant.id}/"
    direct_photo_url = ""
    if profile and getattr(profile, 'profile_photo', None):
        try:
            direct_photo_url = profile.profile_photo.url
        except Exception:
            direct_photo_url = ""

    session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first()
    return {
        "merchant_id": merchant.id,
        "name": shop_name,
        "logo": direct_photo_url or avatar_url,
        "profile_photo": direct_photo_url,
        "avatar_url": avatar_url,
        "session_code": session.code if session else "",
    }


def _resolve_or_create_merchant_agent(merchant):
    """
    Find the best AgentAI for storefront chat with a merchant, or auto-create a web_widget agent
    so every seller on the storefront can receive messages and use AI auto-reply immediately.
    """
    agent = (
        AgentAI.objects.filter(user=merchant, platform='web_widget', is_active=True)
        .order_by('-id')
        .first()
    )
    if not agent:
        agent = (
            AgentAI.objects.filter(user=merchant, is_active=True)
            .exclude(platform__in=['youtube', 'facebook_comment'])
            .order_by('-id')
            .first()
        )
    if not agent:
        agent = AgentAI.objects.filter(user=merchant).order_by('-id').first()

    if not agent:
        profile = getattr(merchant, 'profile', None)
        shop_name = getattr(profile, 'shop_name', None) or merchant.name or "Smart Shop"
        widget_key = str(uuid.uuid4())
        agent = AgentAI.objects.create(
            user=merchant,
            name=f"{shop_name} AI",
            platform='web_widget',
            ai_agent_type='business',
            page_id=f"shop_widget_{merchant.id}_{widget_key[:8]}",
            widget_key=widget_key,
            system_prompt=(
                f"You are the official smart sales & support assistant for {shop_name}. "
                "Help customers with product details, prices, stock, delivery information, and orders politely."
            ),
            greeting_message=f"আসসালামু আলাইকুম! {shop_name}-এ স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি?",
            ai_model="gpt-4o-mini",
            is_active=True,
        )
    elif not agent.page_id:
        agent.page_id = f"agent_{agent.id}"
        agent.save(update_fields=['page_id'])

    return agent


def _resolve_customer_and_contact(request, merchant, agent, visitor_id=None):
    """
    Resolves or creates the Contact and Conversation for this (customer/visitor, merchant agent).
    If the user is an authenticated Customer, also links CustomerIdentity and merges guest visitor messages if needed.
    """
    customer = request.user if isinstance(getattr(request, 'user', None), Customer) else None
    clean_visitor_id = str(visitor_id or '').strip().lower()

    if customer:
        identifier = f"shop_cust_{customer.id}".lower()
        display_name = customer.name or customer.primary_phone or customer.email or "Shop Customer"
        avatar = customer.avatar_url or ""
    else:
        if not clean_visitor_id:
            clean_visitor_id = f"guest_{uuid.uuid4().hex[:12]}"
        identifier = clean_visitor_id if clean_visitor_id.startswith('shop_') else f"shop_guest_{clean_visitor_id}".lower()
        display_name = f"Guest #{clean_visitor_id[-6:].upper()}"
        avatar = ""

    # Use agent's platform or 'web_widget' so Seller Dashboard ContactMessageHistoryView matches Conversation
    platform = (agent.platform or 'web_widget').lower()

    contact, created = Contact.objects.get_or_create(
        agent=agent,
        identifier=identifier,
        defaults={
            'name': display_name,
            'push_name': display_name,
            'platform': platform,
            'profile_photo_url': avatar,
            'is_auto_reply_enabled': True,
        },
    )

    # Update contact name/photo if customer logged in or updated profile
    update_fields = []
    if customer and display_name and contact.name != display_name:
        contact.name = display_name
        contact.push_name = display_name
        update_fields.extend(['name', 'push_name'])
    if customer and avatar and contact.profile_photo_url != avatar:
        contact.profile_photo_url = avatar
        update_fields.append('profile_photo_url')
    if update_fields:
        contact.save(update_fields=update_fields)

    if customer:
        try:
            link_contact_to_customer(customer, contact)
            remember_customer_shop(customer, merchant)
        except Exception as e:
            logger.warning(f"Failed linking customer to shop contact: {e}")

        # If they previously chatted as a guest visitor, migrate guest messages into their customer conversation
        if clean_visitor_id:
            guest_identifier = (
                clean_visitor_id if clean_visitor_id.startswith('shop_') else f"shop_guest_{clean_visitor_id}".lower()
            )
            if guest_identifier != identifier:
                guest_convs = Conversation.objects.filter(
                    agentAi=agent,
                    contact_id__iexact=guest_identifier,
                )
                if guest_convs.exists():
                    target_conv = get_or_create_conversation(agent, identifier, platform=platform)
                    Message.objects.filter(conversation__in=guest_convs).update(conversation=target_conv)
                    Contact.objects.filter(agent=agent, identifier__iexact=guest_identifier).exclude(id=contact.id).delete()

    return customer, contact, identifier, platform


def _build_streaming_prompt(agent, merchant, customer, sender_id, user_text, platform, extra_prompt_addons=None):
    """
    Builds a rich, accurate system prompt for live streaming chat (with RAG, Product Catalog, Customer Orders, and Memory).
    Unlike webhook JSON mode, this instructs the LLM to output natural conversational text directly for token-by-token streaming.
    """
    profile = getattr(merchant, 'profile', None)
    shop_name = getattr(profile, 'shop_name', None) or merchant.name or agent.name or "Our Shop"

    # 1. Perform RAG search if knowledge base exists
    sheet_ctx, extra_instr, _, _ = perform_rag_search(
        agent, user_text, "", "", sender_id=sender_id
    )

    # 2. Live Product Catalog Context
    catalog_context = ""
    try:
        from datasheet.product_search import build_product_context
        catalog_context = build_product_context(merchant, user_text, agent=agent, sender_id=sender_id) or ""
    except Exception:
        pass

    if not catalog_context:
        try:
            products = Product.objects.filter(user=merchant, status='active', is_archived=False).order_by('-id')[:8]
            if products.exists():
                lines = ["[PRODUCTS]:"]
                for p in products:
                    price = p.sale_price if p.sale_price is not None else p.base_price
                    lines.append(f"- {p.name}: ৳{price}")
                catalog_context = "\n".join(lines)
        except Exception as e:
            logger.debug(f"Catalog fallback error: {e}")

    # 3. Customer Recent Orders Context (with this merchant)
    order_history_context = ""
    try:
        import re
        from storefront.services.tracking import build_order_tracking_timeline

        orders_qs = CustomerOrder.objects.filter(user=merchant)
        q_filter = Q()
        if customer:
            q_filter |= Q(customer=customer)
            if getattr(customer, 'primary_phone', None):
                q_filter |= Q(phone_number__endswith=customer.primary_phone[-10:])
        if sender_id:
            q_filter |= Q(source_contact_id__iexact=sender_id)

        recent_orders = orders_qs.filter(q_filter).distinct().order_by('-created_at')[:3] if q_filter else []

        if recent_orders:
            o_lines = ["[CUSTOMER RECENT ORDERS IN LIVE SYSTEM]:"]
            for o in recent_orders:
                courier_name = o.courier or "N/A"
                consignment_id = "N/A"
                try:
                    t_info = build_order_tracking_timeline(o)
                    courier_name = t_info.get('courier_name') or courier_name
                    consignment_id = t_info.get('consignment_id') or consignment_id
                except Exception:
                    pass

                prod_title = o.product_name or (o.items[0].get('name') if o.items and isinstance(o.items, list) and len(o.items) > 0 and isinstance(o.items[0], dict) else "Order Item")
                total_val = float(o.price + (o.delivery_charge or 0))
                o_lines.append(
                    f"- Order #{o.id} (Status: {o.status.upper()}): {prod_title} x{o.item_quantity} | Total: ৳{total_val} | Courier: {courier_name} | Consignment: {consignment_id} | Tracking Link: /orders/{o.public_id}"
                )
            o_lines.append("Instruction: If the user asks about an order update, tell them the live status in Bangla, provide key details, and conclude with [[WIDGET:order_tracking]].")
            order_history_context = "\n".join(o_lines)
        else:
            order_history_context = "[CUSTOMER ORDERS]: No previous orders found for this session yet. If the user asks for order update, politely ask for their Order ID (e.g. #1234) or 11-digit phone number so you can track it, and append [[WIDGET:order_tracking]]."
    except Exception as e:
        logger.debug(f"Order context error: {e}")

    # 4. User Memory Context
    memory_context = ""
    try:
        mem_str = get_memory_context(agent, sender_id)
        if mem_str:
            memory_context = f"[CUSTOMER MEMORY]:\n{mem_str}"
    except Exception:
        pass

    # 5. Contact Custom Prompt / Instructions
    custom_role = agent.system_prompt or f"You are a helpful sales and support assistant for {shop_name}."
    custom_instructions = ""
    try:
        contact = Contact.objects.filter(agent=agent, identifier=sender_id).first()
        if contact:
            if contact.custom_prompt:
                custom_role = contact.custom_prompt
            if contact.custom_instructions:
                custom_instructions = contact.custom_instructions
    except Exception:
        pass

    prompt_parts = [
        STOREFRONT_PROMPT_TEMPLATES["base_system"].format(shop_name=shop_name, custom_role=custom_role),
        _language_mirroring_instruction(user_text),
    ]

    if extra_prompt_addons:
        prompt_parts.extend(extra_prompt_addons)
    if custom_instructions:
        prompt_parts.append(f"[SPECIFIC INSTRUCTIONS]:\n{custom_instructions}")
    if catalog_context:
        prompt_parts.append(catalog_context)
    if sheet_ctx:
        prompt_parts.append(sheet_ctx)
    if order_history_context:
        prompt_parts.append(order_history_context)
    if memory_context:
        prompt_parts.append(memory_context)
    if customer:
        prompt_parts.append(
            f"[AUTHENTICATED CUSTOMER PROFILE]: Name: {customer.name} | Phone: {customer.primary_phone or 'Not set'} | Email: {customer.email}"
        )

    system_instruction = "\n\n".join(prompt_parts)

    # Fetch recent conversation history
    history_limit = getattr(agent.get_settings, 'history_limit', 6) or 6
    raw_history = get_last_message(agent, sender_id, limit=max(history_limit, 6), platform=platform)
    history = [
        msg for msg in raw_history
        if msg.get("content") and msg.get("content").strip()
    ]
    if history and history[-1].get("role") == "user" and history[-1].get("content") == user_text:
        history.pop()

    return system_instruction, history


def _stream_llm_tokens(agent, system_instruction, history, current_message):
    """
    Generator that yields (token_chunk, meta_dict) in real time from OpenAI, Gemini, Grok, or OpenRouter.
    """
    if agent.selected_model:
        model_name = agent.selected_model.model_id
        provider = (agent.selected_model.provider or 'openai').lower()
    else:
        model_name = agent.ai_model or 'gpt-4o-mini'
        provider = 'openai' if 'gpt' in model_name.lower() else 'gemini'

    ai_settings = agent.get_settings
    temperature = ai_settings.temperature if ai_settings.temperature is not None else 0.7
    max_tokens = max(int(ai_settings.max_tokens or 512), 400)

    # 1. Gemini Streaming
    if provider == 'gemini' and getattr(settings, 'GEMINI_API_KEY', None):
        try:
            from aiAgent.gemini import GENAI_CLIENT
            from google.genai import types
            if GENAI_CLIENT:
                gemini_model = model_name if 'gemini' in model_name.lower() else 'gemini-2.5-flash'
                formatted_history = []
                for m in history:
                    role = "model" if m.get("role") == "assistant" else "user"
                    formatted_history.append({"role": role, "parts": [{"text": m.get("content", "")}]})
                formatted_history.append({"role": "user", "parts": [{"text": current_message}]})

                response_stream = GENAI_CLIENT.models.generate_content_stream(
                    model=gemini_model,
                    contents=formatted_history,
                    config=types.GenerateContentConfig(
                        system_instruction=system_instruction,
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                    ),
                )
                for chunk in response_stream:
                    text_piece = getattr(chunk, 'text', None)
                    if text_piece:
                        yield text_piece, {"model": gemini_model, "provider": "gemini"}
                return
        except Exception as gemini_err:
            logger.warning(f"Gemini streaming failed, falling back to OpenAI stream: {gemini_err}")

    # 2. OpenAI / Grok / OpenRouter Streaming
    from openai import OpenAI

    if provider == 'grok' and getattr(settings, 'GROK_API_KEY', None):
        client = OpenAI(api_key=settings.GROK_API_KEY, base_url="https://api.x.ai/v1")
        effective_model = model_name
    elif provider == 'openrouter' and getattr(settings, 'OPENROUTER_API_KEY', None):
        client = OpenAI(api_key=settings.OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1")
        effective_model = model_name
    else:
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        effective_model = model_name if ('gpt' in model_name.lower() or 'o1' in model_name.lower() or 'o3' in model_name.lower()) else 'gpt-4o-mini'

    formatted_messages = [{'role': 'system', 'content': system_instruction}]
    for m in history:
        formatted_messages.append({
            'role': 'assistant' if m.get('role') == 'assistant' else 'user',
            'content': m.get('content', '')
        })
    formatted_messages.append({'role': 'user', 'content': current_message})

    model_lower = effective_model.lower()
    is_new_model = any(m_name in model_lower for m_name in ["gpt-5", "o1", "o3", "gpt-4.1"])
    force_temp_one = any(x in model_lower for x in ["mini", "nano", "o1", "o3"])

    payload = {
        "model": effective_model,
        "messages": formatted_messages,
        "temperature": 1.0 if force_temp_one else temperature,
        "stream": True,
    }
    if is_new_model:
        payload["max_completion_tokens"] = max_tokens
    else:
        payload["max_tokens"] = max_tokens

    stream = client.chat.completions.create(timeout=40.0, **payload)
    for chunk in stream:
        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        token_str = getattr(delta, 'content', None)
        if token_str:
            yield token_str, {"model": effective_model, "provider": provider}


class StorefrontMessageThreadsView(APIView):
    """
    GET /api/storefront/v1/messages/threads/
    Returns the list of seller chat threads for the current customer or guest visitor,
    combining remembered shops, ordered shops, and any active conversations.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        customer = request.user if isinstance(getattr(request, 'user', None), Customer) else None
        visitor_id = (request.query_params.get('visitor_id') or '').strip()
        merchant_ids_param = (request.query_params.get('merchant_ids') or '').strip()

        User = get_user_model()
        merchant_ids = []

        # 1. From query param (localStorage recent sellers)
        if merchant_ids_param:
            for raw_id in merchant_ids_param.split(','):
                if raw_id.strip().isdigit():
                    mid = int(raw_id.strip())
                    if mid not in merchant_ids:
                        merchant_ids.append(mid)

        # 2. From authenticated CustomerShopHistory & CustomerOrders & CustomerIdentities
        if customer:
            history_mids = list(
                CustomerShopHistory.objects.filter(customer=customer)
                .order_by('-last_seen_at')
                .values_list('merchant_id', flat=True)[:15]
            )
            for mid in history_mids:
                if mid not in merchant_ids:
                    merchant_ids.append(mid)

            order_mids = list(
                CustomerOrder.objects.filter(customer=customer)
                .order_by('-created_at')
                .values_list('user_id', flat=True)[:15]
            )
            for mid in order_mids:
                if mid and mid not in merchant_ids:
                    merchant_ids.append(mid)

            identity_mids = list(
                CustomerIdentity.objects.filter(customer=customer, agent__isnull=False)
                .values_list('agent__user_id', flat=True)
            )
            for mid in identity_mids:
                if mid and mid not in merchant_ids:
                    merchant_ids.append(mid)

        # 3. From guest visitor_id contacts
        if visitor_id:
            guest_identifier = (
                visitor_id.lower() if visitor_id.lower().startswith('shop_') else f"shop_guest_{visitor_id.lower()}"
            )
            guest_mids = list(
                Contact.objects.filter(identifier__iexact=guest_identifier)
                .values_list('agent__user_id', flat=True)
            )
            for mid in guest_mids:
                if mid and mid not in merchant_ids:
                    merchant_ids.append(mid)

        # 4. Always include active storefront sellers with products so the seller profile list is complete
        active_mids = list(
            Product.objects.filter(status='active', is_archived=False, user__is_active=True)
            .values_list('user_id', flat=True)
            .distinct()[:20]
        )
        for mid in active_mids:
            if mid and mid not in merchant_ids:
                merchant_ids.append(mid)

        merchants = {
            u.id: u
            for u in User.objects.filter(id__in=merchant_ids, is_active=True).select_related('profile')
        }

        threads = []
        for mid in merchant_ids:
            merchant = merchants.get(mid)
            if not merchant:
                continue

            info = _merchant_display_info(merchant)
            agent = _resolve_or_create_merchant_agent(merchant)

            # Find existing contact/conversation if any (without creating empty contacts on simple list load)
            identifiers_to_check = []
            if customer:
                identifiers_to_check.append(f"shop_cust_{customer.id}".lower())
                linked_ids = list(
                    CustomerIdentity.objects.filter(customer=customer, agent__user=merchant)
                    .values_list('platform_user_id', flat=True)
                )
                identifiers_to_check.extend([i.lower() for i in linked_ids if i])
            if visitor_id:
                g_id = visitor_id.lower() if visitor_id.lower().startswith('shop_') else f"shop_guest_{visitor_id.lower()}"
                identifiers_to_check.append(g_id)

            contact = None
            last_msg = None
            if identifiers_to_check:
                contact = (
                    Contact.objects.filter(agent__user=merchant, identifier__in=identifiers_to_check)
                    .select_related('agent')
                    .order_by('-updated_at')
                    .first()
                )
                convs = Conversation.objects.filter(
                    agentAi__user=merchant,
                    contact_id__in=identifiers_to_check,
                )
                last_msg = Message.objects.filter(conversation__in=convs).order_by('-sent_at').first()

            threads.append({
                "merchant_id": merchant.id,
                "shop_name": info["name"],
                "logo": info["logo"],
                "session_code": info["session_code"],
                "agent_id": agent.id,
                "agent_name": agent.name or f"{info['name']} AI",
                "greeting_message": agent.greeting_message or f"আসসালামু আলাইকুম! {info['name']}-এ স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি?",
                "contact_id": contact.id if contact else None,
                "is_ai_enabled": contact.is_auto_reply_enabled if contact else True,
                "is_human_needed": contact.is_human_needed if contact else False,
                "last_message": last_msg.content if last_msg else None,
                "last_message_role": last_msg.role if last_msg else None,
                "last_message_time": last_msg.sent_at.isoformat() if last_msg else None,
            })

        # Sort threads so active chats with recent messages float to the top
        threads.sort(
            key=lambda t: (t["last_message_time"] is not None, t["last_message_time"] or ""),
            reverse=True,
        )

        return Response({"threads": threads})


class StorefrontMessageHistoryView(APIView):
    """
    GET /api/storefront/v1/messages/history/?merchant_id=<id>&visitor_id=<id>
    Returns message history and live AI/Human mode state for a specific seller.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def get(self, request):
        merchant_id = request.query_params.get('merchant_id')
        visitor_id = request.query_params.get('visitor_id')

        if not merchant_id:
            return Response({"error": "merchant_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        merchant = get_object_or_404(User, id=merchant_id, is_active=True)
        agent = _resolve_or_create_merchant_agent(merchant)
        customer, contact, identifier, platform = _resolve_customer_and_contact(
            request, merchant, agent, visitor_id=visitor_id
        )

        # Include messages from this contact's conversation (and any linked platform identities for this merchant)
        identifiers = [identifier]
        if customer:
            linked = list(
                CustomerIdentity.objects.filter(customer=customer, agent__user=merchant)
                .values_list('platform_user_id', flat=True)
            )
            for lid in linked:
                if lid and lid.lower() not in identifiers:
                    identifiers.append(lid.lower())

        conversations = Conversation.objects.filter(
            agentAi__user=merchant,
            contact_id__in=identifiers,
        )

        messages_qs = (
            Message.objects.filter(conversation__in=conversations)
            .exclude(content__startswith='[System:')
            .order_by('-sent_at')[:80]
        )

        messages_data = []
        for m in reversed(list(messages_qs)):
            raw_content = m.content or ""
            clean_content, m_widget_keys, _, m_params = extract_ai_control_tags(raw_content)
            # If a past message in DB accidentally contained a raw [[WIDGET:...]] tag, clean it now and attach widgets!
            if m_widget_keys and clean_content != raw_content:
                m.content = clean_content
                m.save(update_fields=['content'])
            m_widgets = (
                build_widgets_from_ai_decisions(merchant, customer, visitor_id, m_widget_keys, widget_params=m_params)
                if m_widget_keys
                else []
            )
            messages_data.append({
                "id": m.id,
                "role": m.role,
                "content": clean_content,
                "sent_at": m.sent_at.isoformat() if m.sent_at else None,
                "platform": m.platform,
                "tokens_used": m.tokens_used,
                "sender_type": "customer" if m.role == "user" else ("ai" if (m.tokens_used or 0) > 0 else "seller"),
                "widgets": m_widgets,
            })

        info = _merchant_display_info(merchant)
        return Response({
            "merchant": info,
            "contact": {
                "id": contact.id,
                "identifier": contact.identifier,
                "name": contact.name,
                "is_ai_enabled": contact.is_auto_reply_enabled,
                "is_human_needed": contact.is_human_needed,
            },
            "greeting_message": agent.greeting_message or f"আসসালামু আলাইকুম! {info['name']}-এ স্বাগতম। আপনাকে কীভাবে সাহায্য করতে পারি?",
            "messages": messages_data,
        })


class StorefrontMessageControlView(APIView):
    """
    POST /api/storefront/v1/messages/control/
    Allows customer to request Human Seller support (triggers Seller Dashboard alarm & pauses AI)
    or re-enable AI Assistant mode.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        merchant_id = request.data.get('merchant_id')
        visitor_id = request.data.get('visitor_id')
        action = request.data.get('action')  # 'request_human' | 'enable_ai' | 'pause_ai'

        if not merchant_id or not action:
            return Response({"error": "merchant_id and action are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        merchant = get_object_or_404(User, id=merchant_id, is_active=True)
        agent = _resolve_or_create_merchant_agent(merchant)
        _, contact, identifier, platform = _resolve_customer_and_contact(
            request, merchant, agent, visitor_id=visitor_id
        )

        if action == 'request_human':
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
            contact.save(update_fields=['is_human_needed', 'is_auto_reply_enabled', 'updated_at'])

            # Save a helpful system/assistant notice in conversation and alert Seller Dashboard
            notice = "🙋 আপনার অনুরোধটি সেলারের কাছে পাঠানো হয়েছে। আমাদের একজন প্রতিনিধি শীঘ্রই আপনার সাথে যুক্ত হবেন।"
            save_message(agent, identifier, notice, 'assistant', tokens=0, platform=platform)
            send_human_handoff_ws(
                merchant.id,
                agent.page_id or str(agent.id),
                identifier,
                contact.id,
                contact.name or identifier,
            )
            send_cache_update_ws(
                merchant.id,
                agent.page_id or str(agent.id),
                sender_id=identifier,
                contact_id=contact.id,
            )
            return Response({
                "success": True,
                "is_ai_enabled": False,
                "is_human_needed": True,
                "notice_message": notice,
            })

        elif action == 'enable_ai':
            contact.is_auto_reply_enabled = True
            contact.is_human_needed = False
            contact.save(update_fields=['is_auto_reply_enabled', 'is_human_needed', 'updated_at'])
            send_cache_update_ws(
                merchant.id,
                agent.page_id or str(agent.id),
                sender_id=identifier,
                contact_id=contact.id,
            )
            return Response({
                "success": True,
                "is_ai_enabled": True,
                "is_human_needed": False,
            })

        elif action == 'pause_ai':
            contact.is_auto_reply_enabled = False
            contact.save(update_fields=['is_auto_reply_enabled', 'updated_at'])
            send_cache_update_ws(
                merchant.id,
                agent.page_id or str(agent.id),
                sender_id=identifier,
                contact_id=contact.id,
            )
            return Response({
                "success": True,
                "is_ai_enabled": False,
                "is_human_needed": contact.is_human_needed,
            })

        return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)


class StorefrontMessageStreamView(APIView):
    """
    POST /api/storefront/v1/messages/stream/
    Saves the customer's message, immediately notifies Seller Dashboard via WebSocket,
    and streams AI response tokens live via Server-Sent Events (text/event-stream).
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        merchant_id = request.data.get('merchant_id')
        visitor_id = request.data.get('visitor_id')
        message_text = (request.data.get('message') or '').strip()
        attached_product_id = request.data.get('product_id')

        if not merchant_id or not message_text:
            return Response({"error": "merchant_id and message are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        merchant = get_object_or_404(User, id=merchant_id, is_active=True)
        agent = _resolve_or_create_merchant_agent(merchant)
        customer, contact, identifier, platform = _resolve_customer_and_contact(
            request, merchant, agent, visitor_id=visitor_id
        )

        # 1. Save customer's message to Conversation & update Contact timestamp
        user_msg = save_message(agent, identifier, message_text, 'user', tokens=0, platform=platform)
        contact.updated_at = timezone.now()
        contact.save(update_fields=['updated_at'])

        # 2. Immediately notify Seller Dashboard (/dashboard/contacts) via WebSocket
        agent_ws_id = agent.page_id or str(agent.id)
        send_cache_update_ws(
            merchant.id,
            agent_ws_id,
            sender_id=identifier,
            contact_id=contact.id,
        )

        def event_stream():
            start_ts = monotonic()
            # Send a 2KB SSE comment padding prelude so Cloudflare/Nginx/Browser flush chunks immediately
            yield f": {' ' * 2048}\n\n"
            # Emit initial acknowledgment with saved user message metadata
            yield f"data: {json.dumps({'type': 'user_saved', 'user_message': {'id': user_msg.id, 'content': user_msg.content, 'sent_at': user_msg.sent_at.isoformat(), 'role': 'user', 'sender_type': 'customer'}, 'contact_id': contact.id, 'is_ai_enabled': contact.is_auto_reply_enabled, 'is_human_needed': contact.is_human_needed})}\n\n"

            # 3. Check if AI Auto-Reply is paused (Seller manual / human mode)
            if not contact.is_auto_reply_enabled:
                yield f"data: {json.dumps({'type': 'human_mode', 'is_ai_enabled': False, 'is_human_needed': contact.is_human_needed, 'message': 'সেলার ম্যানুয়াল মোডে আছেন। আপনার মেসেজটি সেলারের ড্যাশবোর্ডে পৌঁছে গেছে, শীঘ্রই উত্তর পাবেন।'})}\n\n"
                return

            # 4. Build RAG + Product Catalog + Order + AI UI Widget Decision Engine prompt
            try:
                yield f"data: {json.dumps({'type': 'thinking'})}\n\n"
                prompt_addons = [build_storefront_engine_prompt_addon(customer=customer)]
                initial_widgets = []

                if attached_product_id:
                    pw = build_product_detail_widget(merchant, attached_product_id)
                    if pw:
                        initial_widgets.append(pw)
                        p_obj = pw.get("product") or {}
                        prompt_addons.append(
                            f"[ATTACHED PRODUCT]: {p_obj.get('name')} | ৳{p_obj.get('price')} | Stock:{p_obj.get('stock')} | {p_obj.get('description')}"
                        )

                system_instruction, history = _build_streaming_prompt(
                    agent,
                    merchant,
                    customer,
                    identifier,
                    message_text,
                    platform,
                    extra_prompt_addons=prompt_addons,
                )

                raw_chunks = []
                stream_hold_buffer = ""
                used_model = agent.selected_model.model_id if agent.selected_model else (agent.ai_model or 'gpt-4o-mini')

                for token_piece, meta in _stream_llm_tokens(agent, system_instruction, history, message_text):
                    if meta.get('model'):
                        used_model = meta['model']
                    raw_chunks.append(token_piece)
                    stream_hold_buffer += token_piece

                    # Hold back any `[` in stream_hold_buffer until we know whether it's a control tag `[[...]]`
                    if "[" in stream_hold_buffer:
                        idx = stream_hold_buffer.find("[")
                        safe_part = stream_hold_buffer[:idx]
                        remainder = stream_hold_buffer[idx:]
                        if safe_part:
                            yield f"data: {json.dumps({'type': 'token', 'token': safe_part})}\n\n"
                        # If it's a single `[` followed by a non-`[` character, it's normal text — flush the `[`
                        if len(remainder) >= 2 and not remainder.startswith("[["):
                            yield f"data: {json.dumps({'type': 'token', 'token': remainder[0]})}\n\n"
                            stream_hold_buffer = remainder[1:]
                        else:
                            stream_hold_buffer = remainder
                    else:
                        yield f"data: {json.dumps({'type': 'token', 'token': stream_hold_buffer})}\n\n"
                        stream_hold_buffer = ""

                if stream_hold_buffer:
                    leftover_clean, _, _, _ = extract_ai_control_tags(stream_hold_buffer)
                    if leftover_clean:
                        yield f"data: {json.dumps({'type': 'token', 'token': leftover_clean})}\n\n"

                full_raw_reply = "".join(raw_chunks).strip()
                final_reply, decided_widget_keys, decided_action_keys, decided_params = extract_ai_control_tags(full_raw_reply)

                if not final_reply:
                    final_reply = "নিচের কার্ড থেকে বিস্তারিত দেখুন:"
                    yield f"data: {json.dumps({'type': 'token', 'token': final_reply})}\n\n"

                # Build interactive UI widgets decided by the AI (with AI-extracted parameters)
                ai_widgets = build_widgets_from_ai_decisions(
                    merchant, customer, visitor_id, decided_widget_keys, user_text=message_text, widget_params=decided_params
                )
                ui_widgets = initial_widgets + ai_widgets
                if ui_widgets:
                    yield f"data: {json.dumps({'type': 'widgets', 'widgets': ui_widgets})}\n\n"

                # Handle AI-decided actions (such as human_handoff)
                if "human_handoff" in decided_action_keys:
                    contact.is_human_needed = True
                    contact.is_auto_reply_enabled = False
                    contact.save(update_fields=['is_human_needed', 'is_auto_reply_enabled', 'updated_at'])
                    send_human_handoff_ws(
                        merchant.id, agent_ws_id, identifier, contact.id, contact.name or identifier
                    )

                # Calculate & log tokens
                input_tokens = count_openai_tokens(system_instruction + str(history) + message_text, used_model)
                output_tokens = max(1, count_openai_tokens(full_raw_reply or final_reply, used_model))
                total_tokens = input_tokens + output_tokens

                saved_ai = save_message(
                    agent, identifier, final_reply, 'assistant', tokens=total_tokens, platform=platform
                )
                contact.updated_at = timezone.now()
                contact.save(update_fields=['updated_at'])

                # Deduct tokens if seller has active subscription (best-effort)
                try:
                    if hasattr(merchant, 'profile') and check_token_availability(merchant.profile, used_model):
                        deduct_user_tokens(merchant.profile, total_tokens, used_model)
                except Exception as tok_err:
                    logger.debug(f"Token deduction skipped in storefront stream: {tok_err}")

                duration_ms = int((monotonic() - start_ts) * 1000)
                log_token_usage(
                    agent,
                    identifier,
                    {
                        'input_tokens': input_tokens,
                        'output_tokens': output_tokens,
                        'total_tokens': total_tokens,
                        'success': True,
                    },
                    duration_ms,
                    'shop_stream',
                    platform=platform,
                )

                # Update smart memory
                try:
                    handle_smart_memory_update(agent, identifier, message_text)
                except Exception as mem_err:
                    logger.debug(f"Smart memory update skipped: {mem_err}")

                # Broadcast to Seller Dashboard so seller sees AI reply live too!
                send_cache_update_ws(
                    merchant.id,
                    agent_ws_id,
                    sender_id=identifier,
                    contact_id=contact.id,
                )

                yield f"data: {json.dumps({'type': 'done', 'is_ai_enabled': contact.is_auto_reply_enabled, 'is_human_needed': contact.is_human_needed, 'assistant_message': {'id': saved_ai.id, 'content': final_reply, 'sent_at': saved_ai.sent_at.isoformat(), 'role': 'assistant', 'tokens_used': total_tokens, 'sender_type': 'ai', 'widgets': ui_widgets}})}\n\n"

            except Exception as err:
                logger.error(f"Storefront streaming error: {err}", exc_info=True)
                fallback_msg = "দুঃখিত, সংযোগে সাময়িক সমস্যা হয়েছে। আপনার মেসেজটি সেলারের কাছে পৌঁছেছে।"
                saved_err = save_message(agent, identifier, fallback_msg, 'assistant', tokens=0, platform=platform)
                send_cache_update_ws(merchant.id, agent_ws_id, sender_id=identifier, contact_id=contact.id)
                yield f"data: {json.dumps({'type': 'error', 'message': fallback_msg, 'assistant_message': {'id': saved_err.id, 'content': fallback_msg, 'sent_at': saved_err.sent_at.isoformat(), 'role': 'assistant', 'sender_type': 'ai'}})}\n\n"

        response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache, no-transform'
        response['X-Accel-Buffering'] = 'no'
        return response


class StorefrontMessageWidgetActionView(APIView):
    """
    POST /api/storefront/v1/messages/widget-action/
    Handles interactive UI widget actions inside the Storefront Conversational Engine:
    - 'open_delivery_template': Opens the Saved Addresses + Delivery Charge Calculator template
    - 'open_address_form': Opens the Checkout-style interactive Address Form template
    - 'open_product_showcase': Opens the Product Catalog Showcase template
    - 'calculate_address_quote': Calculates live delivery charge for a selected/submitted address,
      optionally saves the address to CustomerAddress (if logged in), logs the calculation in the
      conversation so the Seller Dashboard sees it, and returns a structured `live_delivery_quote_card` widget.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        merchant_id = request.data.get('merchant_id')
        visitor_id = request.data.get('visitor_id')
        action = (request.data.get('action') or '').strip()

        if not merchant_id or not action:
            return Response({"error": "merchant_id and action are required"}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()
        merchant = get_object_or_404(User, id=merchant_id, is_active=True)
        agent = _resolve_or_create_merchant_agent(merchant)
        customer, contact, identifier, platform = _resolve_customer_and_contact(
            request, merchant, agent, visitor_id=visitor_id
        )

        # 1. Open templates on demand (from quick toolbar buttons or inside another widget)
        if action == 'open_delivery_template':
            widget = build_delivery_inquiry_widget(merchant, customer=customer, visitor_id=visitor_id)
            return Response({
                "success": True,
                "widget": widget,
                "assistant_text": "📍 আপনার সংরক্ষিত ঠিকানা থেকে যেকোনো একটি সিলেক্ট করে লাইভ ডেলিভারি চার্জ দেখুন অথবা নতুন ঠিকানা যোগ করুন:",
            })

        if action == 'open_address_form':
            widget = build_address_form_widget(merchant, customer=customer)
            return Response({
                "success": True,
                "widget": widget,
                "assistant_text": "📝 নিচের চেকআউট ফর্মে আপনার জেলা, থানা এবং বিস্তারিত ঠিকানা নির্বাচন করুন:",
            })

        if action == 'open_product_showcase':
            widget = build_product_showcase_widget(merchant)
            return Response({
                "success": True,
                "widget": widget,
                "assistant_text": "🛍️ আমাদের স্টকে থাকা জনপ্রিয় পণ্যগুলো নিচে দেওয়া হলো:",
            })

        if action == 'open_order_tracking':
            widget = build_order_tracking_widget(merchant, customer=customer, visitor_id=visitor_id)
            return Response({
                "success": True,
                "widget": widget,
                "assistant_text": "📦 আপনার সাম্প্রতিক অর্ডার ও লাইভ ট্র্যাকিং তথ্য নিচে দেওয়া হলো:" if widget.get("has_orders") else "📦 আপনার অর্ডারের তথ্য খুঁজতে নিচে অর্ডার আইডি (#1234) বা মোবাইল নম্বর লিখুন:",
            })

        # 2. Calculate Live Delivery Charge for a Selected or Newly Submitted Address
        if action == 'calculate_address_quote':
            addr_data = request.data.get('address') or {}
            save_new = bool(request.data.get('save_new_address', False))
            courier_provider = (request.data.get('courier_provider') or addr_data.get('courier_provider') or '').strip().lower()

            recipient_name = (addr_data.get('recipient_name') or (customer.name if customer else '') or 'গ্রাহক').strip()
            phone = (addr_data.get('phone') or (customer.primary_phone if customer else '') or '').strip()
            full_address = (addr_data.get('full_address') or '').strip()
            district = (addr_data.get('district') or '').strip()
            upazila = (addr_data.get('upazila') or '').strip()
            courier_ids = addr_data.get('courier_location_ids') or {}

            # Auto-resolve courier mapping if not already provided
            if not courier_ids and (full_address or district or upazila):
                try:
                    resolved = resolve_courier_mapping_for_address(full_address, district=district, upazila=upazila)
                    if resolved:
                        district = district or resolved.get('district', '')
                        upazila = upazila or resolved.get('upazila', '')
                        courier_ids = {
                            k: v for k, v in {
                                'pathao': resolved.get('pathao'),
                                'steadfast': resolved.get('steadfast'),
                            }.items() if v
                        }
                except Exception as e:
                    logger.debug(f"Address mapping resolve skipped: {e}")

            saved_address_obj = None
            if save_new and customer and full_address:
                try:
                    saved_address_obj = CustomerAddress.objects.create(
                        customer=customer,
                        recipient_name=recipient_name,
                        phone=phone,
                        full_address=full_address,
                        district=district,
                        upazila=upazila,
                        courier_location_ids=courier_ids,
                        is_default=not CustomerAddress.objects.filter(customer=customer).exists(),
                    )
                except Exception as e:
                    logger.warning(f"Failed saving customer address from chat widget: {e}")

            quote = calculate_delivery_charge(
                merchant=merchant,
                district=district,
                courier_ids=courier_ids,
                item_weight=0.5,
                courier_provider=courier_provider,
            )

            charge_val = float(quote.get('delivery_charge') or 100)
            est_days = quote.get('estimated_days') or '২-৪ দিন'
            provider_label = quote.get('courier_provider') or 'Standard Courier'
            region_label = quote.get('region') or district or 'বাংলাদেশ'

            location_summary = " › ".join([x for x in [district, upazila] if x]) or full_address or "নির্বাচিত ঠিকানা"
            summary_reply = (
                f"✅ ডেলিভারি চার্জ হিসাব করা হয়েছে!\n"
                f"📍 এলাকা: {location_summary}\n"
                f"🏠 ঠিকানা: {full_address or location_summary}\n"
                f"🚚 কুরিয়ার: {provider_label}\n"
                f"💰 ডেলিভারি চার্জ: ৳{int(charge_val)}\n"
                f"⏱️ সম্ভাব্য সময়: {est_days}"
            )

            saved_msg = save_message(agent, identifier, summary_reply, 'assistant', tokens=0, platform=platform)
            contact.updated_at = timezone.now()
            contact.save(update_fields=['updated_at'])

            agent_ws_id = agent.page_id or str(agent.id)
            send_cache_update_ws(merchant.id, agent_ws_id, sender_id=identifier, contact_id=contact.id)

            quote_widget = {
                "widget_type": "live_delivery_quote_card",
                "merchant_id": merchant.id,
                "delivery_charge": charge_val,
                "estimated_days": est_days,
                "courier_provider": provider_label,
                "region": region_label,
                "quote_source": quote.get('quote_source', 'standard'),
                "address": {
                    "id": saved_address_obj.id if saved_address_obj else addr_data.get('id'),
                    "recipient_name": recipient_name,
                    "phone": phone,
                    "full_address": full_address,
                    "district": district,
                    "upazila": upazila,
                    "courier_location_ids": courier_ids,
                },
            }

            updated_saved = []
            if customer:
                addrs = CustomerAddress.objects.filter(customer=customer).order_by('-is_default', '-created_at')[:6]
                updated_saved = CustomerAddressSerializer(addrs, many=True).data

            return Response({
                "success": True,
                "quote": {
                    "delivery_charge": charge_val,
                    "estimated_days": est_days,
                    "courier_provider": provider_label,
                    "region": region_label,
                },
                "saved_address": CustomerAddressSerializer(saved_address_obj).data if saved_address_obj else None,
                "saved_addresses": updated_saved,
                "assistant_message": {
                    "id": saved_msg.id,
                    "role": "assistant",
                    "content": summary_reply,
                    "sent_at": saved_msg.sent_at.isoformat(),
                    "sender_type": "ai",
                    "widgets": [quote_widget],
                },
            })

        # 3. Quick Direct In-Chat Order Submission
        if action == 'submit_chat_order':
            product_id = request.data.get('product_id')
            quantity = max(1, int(request.data.get('quantity', 1)))
            addr_data = request.data.get('address') or {}
            courier_provider_code = (request.data.get('courier_provider') or addr_data.get('courier_provider') or '').strip().lower()

            recipient_name = (addr_data.get('recipient_name') or (customer.name if customer else '') or 'গ্রাহক').strip()
            phone = (addr_data.get('phone') or (customer.primary_phone if customer else '') or '').strip()
            full_address = (addr_data.get('full_address') or '').strip()
            district = (addr_data.get('district') or '').strip()
            upazila = (addr_data.get('upazila') or '').strip()
            courier_ids = addr_data.get('courier_location_ids') or {}
            special_instruction = request.data.get('special_instruction', '')

            if not phone or not full_address:
                return Response({"error": "মোবাইল নম্বর ও ডেলিভারি ঠিকানা প্রয়োজন"}, status=status.HTTP_400_BAD_REQUEST)

            # Resolve product
            product = None
            if product_id:
                product = Product.objects.filter(id=product_id, user=merchant, status='active', is_archived=False).first()

            if not product:
                product = Product.objects.filter(user=merchant, status='active', is_archived=False).order_by('-id').first()

            if not product:
                return Response({"error": "অর্ডারের জন্য কোনো সক্রিয় পণ্য পাওয়া যায়নি"}, status=status.HTTP_400_BAD_REQUEST)

            unit_price = Decimal(str(product.sale_price if product.sale_price is not None else (product.base_price or 0)))
            subtotal = unit_price * quantity

            # Resolve courier mapping
            if not courier_ids and (full_address or district or upazila):
                try:
                    resolved = resolve_courier_mapping_for_address(full_address, district=district, upazila=upazila)
                    if resolved:
                        district = district or resolved.get('district', '')
                        upazila = upazila or resolved.get('upazila', '')
                        courier_ids = {
                            k: v for k, v in {
                                'pathao': resolved.get('pathao'),
                                'steadfast': resolved.get('steadfast'),
                            }.items() if v
                        }
                except Exception as e:
                    logger.debug(f"Address mapping error in chat order: {e}")

            quote = calculate_delivery_charge(
                merchant=merchant,
                district=district,
                courier_ids=courier_ids,
                item_weight=0.5,
                courier_provider=courier_provider_code,
            )
            delivery_charge = quote.get('delivery_charge', Decimal('100.00'))
            courier_name = quote.get('courier_provider') or 'Standard Courier'

            # Build items payload
            prod_img = ""
            if product.gallery_images and isinstance(product.gallery_images, list) and product.gallery_images[0]:
                prod_img = product.gallery_images[0]
            elif product.gallery.exists() and product.gallery.first().image:
                try:
                    prod_img = product.gallery.first().image.url
                except Exception:
                    prod_img = ""

            order_items = [{
                'product_id': product.id,
                'name': product.name,
                'quantity': quantity,
                'price': float(unit_price),
                'sku': product.base_sku or '',
                'image_url': prod_img,
            }]

            # Create or resolve checkout session for tracking
            session = CheckoutSession.objects.filter(merchant=merchant, contact=contact).order_by('-created_at').first()
            if not session:
                session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first()

            order = CustomerOrder.objects.create(
                user=merchant,
                customer=customer,
                contact=contact,
                checkout_session=session,
                customer_name=recipient_name,
                phone_number=phone,
                address=full_address,
                district=district,
                upazila=upazila,
                product_name=f"{product.name} (x{quantity})",
                items=order_items,
                price=subtotal,
                delivery_charge=delivery_charge,
                courier=courier_provider_code or 'manual',
                status='confirmed',
                source_platform='shop_chat',
                source_contact_id=identifier,
                special_instruction=special_instruction,
            )

            if customer:
                remember_customer_shop(customer, merchant, increment_order=True)

            order_success_reply = (
                f"🎉 অভিনন্দন! আপনার অর্ডারটি সফলভাবে সম্পন্ন হয়েছে।\n"
                f"📦 অর্ডার নম্বর: #{order.id}\n"
                f"🛍️ পণ্য: {product.name} (পরিমাণ: {quantity})\n"
                f"💰 পণ্যের মূল্য: ৳{int(subtotal)}\n"
                f"🚚 ডেলিভারি চার্জ: ৳{int(delivery_charge)}\n"
                f"💵 সর্বমোট বিল: ৳{int(subtotal + delivery_charge)}\n"
                f"📍 ডেলিভারি ঠিকানা: {full_address}\n"
                f"📞 ফোন নম্বর: {phone}\n"
                f"আমাদের প্রতিনিধি শীঘ্রই আপনার অর্ডারের বিষয়ে যোগাযোগ করবেন।"
            )

            saved_msg = save_message(agent, identifier, order_success_reply, 'assistant', tokens=0, platform=platform)
            contact.updated_at = timezone.now()
            contact.save(update_fields=['updated_at'])

            agent_ws_id = agent.page_id or str(agent.id)
            send_cache_update_ws(merchant.id, agent_ws_id, sender_id=identifier, contact_id=contact.id)

            order_card_widget = {
                "widget_type": "order_confirmed_card",
                "order_id": order.id,
                "product_name": product.name,
                "quantity": quantity,
                "price": float(subtotal),
                "delivery_charge": float(delivery_charge),
                "total": float(subtotal + delivery_charge),
                "address": full_address,
                "phone": phone,
                "status": "confirmed",
                "created_at": order.created_at.isoformat(),
            }

            return Response({
                "success": True,
                "order_id": order.id,
                "assistant_message": {
                    "id": saved_msg.id,
                    "role": "assistant",
                    "content": order_success_reply,
                    "sent_at": saved_msg.sent_at.isoformat(),
                    "sender_type": "ai",
                    "widgets": [order_card_widget],
                },
            })

        return Response({"error": "Unsupported widget action"}, status=status.HTTP_400_BAD_REQUEST)

