# webhooks/tasks.py

from celery import shared_task
import os, re, json, time, uuid, logging, hashlib, redis, requests
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from users.models import CustomerOrder
from aiAgent.models import AgentAI, UserMemory
from aiAgent.validators.field_validators import validate_phone_number_bd, validate_quantity, validate_price
from django.db.models import Q
from chat.services import save_message, get_last_message
from aiAgent.memory_handler import handle_smart_memory_update
from aiAgent.utils import normalize_order_entities
from aiAgent.cache.hybrid_similarity import (
    get_cached_reply, set_cached_reply, fuzzy_match,
    get_global_cached_reply, set_global_cached_reply, global_fuzzy_match,
    get_sender_cached_reply, set_sender_cached_reply,
    normalize_for_cache,
)
from aiAgent.cache.ranking import incr_message_frequency
from aiAgent.cache.metrics import incr_counter
from aiAgent.cache.cluster import get_cluster_map
from chat.utils import get_smart_post_context

from aiAgent.business_logic.logic_handler import (
    is_duplicate_or_outdated, acquire_user_lock, get_order_instructions,
    perform_rag_search, build_ai_context, get_ai_response,
    log_token_usage, deduct_user_tokens, deliver_whatsapp_reply, deliver_instagram_reply, deliver_facebook_reply, deliver_telegram_reply, handle_public_comment_logic,
    check_token_availability, deliver_dashboard_reply
)
from aiAgent.platform_image_router import route_images
from aiAgent.image_delivery_tools import execute_image_delivery_tool
from webhooks.utils import fetch_messenger_profile
from aiAgent.cache.redis_vector import (
    save_vector_embedding,
    search_similar_vectors
)

from aiAgent.business_logic import logic_handler

from celery.signals import after_setup_logger, after_setup_task_logger
import logging.config
from django.conf import settings
from django.utils import timezone
from aiAgent.cache.client import get_redis_client
from . import youtube_tasks
from PIL import Image


def is_system_redis_cache_enabled():
    """Return the admin-controlled system-wide response-cache switch."""
    try:
        from settings.models import GlobalSettings
        return bool(GlobalSettings.get_settings().global_redis_cache_enabled)
    except Exception:
        # Cache control must never break message processing during migrations/startup.
        return True


@after_setup_logger.connect
@after_setup_task_logger.connect
def setup_celery_logging(logger, **kwargs):
    logging.config.dictConfig(settings.LOGGING)

logger = logging.getLogger(__name__)

r = get_redis_client(db=0)

BUTTON_VOICE_PLATFORMS = {'whatsapp', 'messenger', 'facebook_comment', 'instagram', 'telegram'}


def _product_cache_policy(agent_config, text):
    """Conservatively bypass generic AI reply caches when message references active catalog products."""
    from datasheet.product_search import extract_product_query
    try:
        query = extract_product_query(text)
        terms = [term for term in query.get("product_terms", "").split() if len(term) >= 2]
        if terms:
            from datasheet.models import Product
            product_query = Q()
            for term in terms:
                product_query |= (
                    Q(name__icontains=term)
                    | Q(category__icontains=term)
                    | Q(description__icontains=term)
                    | Q(base_sku__icontains=term)
                )
            if Product.objects.filter(
                user=agent_config.user, status="active"
            ).filter(product_query).exists():
                return True, "catalog_product_match"
    except Exception as exc:
        logger.warning("product_cache_policy_check_failed error=%s", type(exc).__name__)
        return True, "policy_check_failed"
    return False, ""


def clean_ai_response(raw_reply):
    """
    💥 FIX: Extracts valid JSON from AI response and fixes type mismatches.
    
    Problems solved:
    1. AI sometimes returns text + JSON instead of just JSON
    2. AI sends int/bool instead of string for fields like phone_number, address, etc.
    3. Prevents "expected string or bytes-like object, got 'int'" errors
    
    Returns: Cleaned parsed dict or fallback dict on error
    """
    import json
    import re
    
    if not isinstance(raw_reply, str):
        raw_reply = str(raw_reply) if raw_reply else ''
    
    # ১. Try to extract JSON from within mixed text
    try:
        json_match = re.search(r'\{.*\}', raw_reply, re.DOTALL)
        if json_match:
            raw_reply = json_match.group(0)
    except Exception:
        pass
    
    # ২. Parse JSON
    try:
        data = json.loads(raw_reply)
    except json.JSONDecodeError:
        logger.warning(f"⚠️ Failed to parse AI response as JSON: {raw_reply[:100]}...")
        return {
            "reply": str(raw_reply),
            "cache_type": "no_cache",
            "human_handoff": False,
            "image_intent": False,
            "image_ids": [],
            "order_intent": None,
            "order_data": {}
        }
    
    if not isinstance(data, dict):
        data = {"reply": str(data)}
    
    data.setdefault("reply", "")
    data.setdefault("cache_type", "no_cache")
    data.setdefault("human_handoff", False)
    data.setdefault("image_intent", False)
    data.setdefault("image_ids", [])
    data.setdefault("order_intent", None)
    data.setdefault("order_data", {})
    
    # ৩. 💥 Force-convert all order_data fields to proper types (CRITICAL FIX)
    if isinstance(data["order_data"], dict):
        order_data = data["order_data"]
        
        # String fields: FORCE convert to string (fixes 'got int' error)
        string_fields = ["phone_number", "customer_name", "address", "product_name", "extra_info", "item_description"]
        for field in string_fields:
            if field in order_data and order_data[field] is not None:
                order_data[field] = str(order_data[field]).strip()
        
        # Quantity/Price must be numeric
        if "quantity" in order_data and order_data["quantity"] is not None:
            try:
                order_data["quantity"] = int(str(order_data["quantity"]).strip())
            except (ValueError, TypeError):
                order_data["quantity"] = 1
        
        if "price" in order_data and order_data["price"] is not None:
            try:
                order_data["price"] = float(str(order_data["price"]).strip())
            except (ValueError, TypeError):
                order_data["price"] = 0
    else:
        data["order_data"] = {}
    
    return data


def _parse_sheet_row_id(row_id):
    """Parse a row_id string like sheet_{sheet_id}_row_{row_index}."""
    if not row_id or not isinstance(row_id, str):
        return None, None
    try:
        parts = row_id.split('_')
        if len(parts) >= 4 and parts[0] == 'sheet' and parts[2] == 'row':
            return int(parts[1]), int(parts[3])
    except Exception:
        pass
    return None, None


BENGALI_DIGIT_MAP = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')


def _normalize_bengali_digits(text):
    if not isinstance(text, str):
        return text
    return text.translate(BENGALI_DIGIT_MAP)


def _extract_order_data_with_ai(agent_config, sender_id, text):
    if not agent_config or not text:
        return {}

    try:
        instruction = (
            "Extract only order field values from the customer's message. "
            "Return only a valid JSON object containing any of the following keys: "
            "customer_name, phone_number, address, product_name, quantity, extra_info. "
            "Do not include any other keys. "
            "If there is no order-related information, return {}."
        )
        ai_data = get_ai_response(agent_config, instruction, [], text)
        raw_reply = ''
        if isinstance(ai_data, dict):
            raw_reply = ai_data.get('reply', '')
        else:
            raw_reply = str(ai_data)

        parsed = clean_ai_response(raw_reply)
        if not isinstance(parsed, dict):
            return {}

        if isinstance(parsed.get('order_data'), dict):
            parsed = parsed.get('order_data')

        return {
            field: str(parsed[field]).strip()
            for field in ORDER_FIELDS
            if parsed.get(field) not in [None, '']
        }
    except Exception as e:
        logger.debug(f"AI order extraction fallback failed: {e}")
        return {}


def _clean_caption_for_user(caption):
    if not caption:
        return "Product Image"
    tags_to_remove = ["Clothing, ", "Electronics, ", "Primary Color: ", "Unique Visual Identifier: "]
    cleaned = caption
    for tag in tags_to_remove:
        cleaned = cleaned.replace(tag, "")
    # Keep it short (first 2 segments)
    parts = [p.strip() for p in cleaned.split(',') if p.strip()]
    if len(parts) >= 2:
        return ", ".join(parts[:2])
    return cleaned


def _deliver_images_for_ai_response(request_type, data, parsed_ai, best_row_id, agent_config, sender_id=None):
    if not parsed_ai or not isinstance(parsed_ai, dict):
        return False, None

    image_intent = parsed_ai.get('image_intent')
    if isinstance(image_intent, str):
        image_intent = image_intent.strip().lower() in ['true', 'yes', '1']
    if not image_intent:
        return False, None

    # 💥 DIRECT AI IMAGE ID SELECTION DELIVERY
    image_ids = parsed_ai.get('image_ids') or []
    if isinstance(image_ids, (int, str)):
        try: image_ids = [int(image_ids)]
        except: image_ids = []
    elif isinstance(image_ids, list):
        clean_ids = []
        for item in image_ids:
            try: clean_ids.append(int(item))
            except: pass
        image_ids = clean_ids

    platform = request_type if request_type in ['whatsapp', 'messenger', 'instagram', 'telegram', 'tiktok'] else None
    if not platform:
        logger.warning(f'Image delivery not supported for platform: {request_type}')
        return False, None

    if not agent_config or not getattr(agent_config, 'user', None):
        logger.warning('Image delivery failed: missing agent user context.')
        return False, None

    # 1. Product gallery delivery for active product or matched Product IDs
    try:
        from datasheet.models import Product, ProductGalleryImage
        from aiAgent.models import UserMemory
        from django.core.files.storage import default_storage

        memory = UserMemory.objects.filter(
            ai_agent=agent_config,
            sender_id=str(sender_id or '').lower(),
        ).first()
        memory_context = ((memory.data or {}).get('_internal', {}) if memory else {}).get(
            'last_product_image_context', {}
        )
        product_id = memory_context.get('product_id')
        variant_id = memory_context.get('variant_id')
        product_name = ((parsed_ai.get('order_data') or {}).get('product_name') if isinstance(parsed_ai.get('order_data'), dict) else None)

        product = None
        if product_id:
            product = Product.objects.filter(
                id=product_id, user=agent_config.user, status='active'
            ).first()
        if not product and image_ids:
            product = Product.objects.filter(
                id__in=image_ids, user=agent_config.user, status='active'
            ).first()
        if not product and product_name:
            product = Product.objects.filter(
                user=agent_config.user, status='active', name__iexact=str(product_name).strip()
            ).first() or Product.objects.filter(
                user=agent_config.user, status='active', name__icontains=str(product_name).strip()
            ).first()
        if not product:
            recent_interest = ((memory.data or {}).get('_internal', {}) if memory else {}).get('recent_order_interest', {})
            recent_name = recent_interest.get('product_name') if isinstance(recent_interest, dict) else None
            if recent_name:
                product = Product.objects.filter(
                    user=agent_config.user, status='active', name__icontains=str(recent_name).strip()
                ).first()

        if product:
            variants = list(product.variants.all().prefetch_related('gallery_images'))
            image_items = []

            # 1. If product has distinct variants, take the primary (default) image for each variant
            if len(variants) > 1:
                for var in variants[:10]:
                    var_img = var.gallery_images.filter(processing_status='ready').order_by('-is_primary', 'position', 'id').first()
                    if not var_img:
                        var_img = ProductGalleryImage.objects.filter(product=product, variant=var, processing_status='ready').order_by('-is_primary', 'position', 'id').first()
                    if var_img and var_img.image:
                        # Extract variant label (e.g. Color: Arctic White or Size: XL)
                        attrs = var.attributes if isinstance(var.attributes, dict) else {}
                        var_label = ", ".join(str(v) for v in attrs.values()) if attrs else (var.sku or "")
                        var_price = var.price if var.price is not None else (product.sale_price or product.base_price)
                        image_items.append({
                            'url': default_storage.url(var_img.image.name),
                            'caption': var_img.image_caption or var_img.alt_text or f"{product.name} ({var_label})",
                            'variant_id': var.id,
                            'variant_label': var_label,
                            'price': float(var_price or 0),
                            'sku': var.sku or ""
                        })

            # 2. If no variants or single variant, take all images for the product (primary image first)
            if not image_items:
                gallery_query = ProductGalleryImage.objects.filter(
                    product=product, processing_status='ready'
                ).order_by('-is_primary', 'position', 'id')
                if variant_id:
                    v_query = gallery_query.filter(variant_id=variant_id)
                    if v_query.exists():
                        gallery_query = v_query

                for img in gallery_query[:10]:
                    if img.image:
                        image_items.append({
                            'url': default_storage.url(img.image.name),
                            'caption': img.image_caption or img.alt_text or product.name,
                            'variant_id': img.variant_id,
                            'variant_label': '',
                            'price': float(product.sale_price or product.base_price or 0),
                            'sku': getattr(product, 'base_sku', '') or ''
                        })

            if image_items:
                image_urls = [itm['url'] for itm in image_items]
                captions = [itm['caption'] for itm in image_items]
                route_result = route_images(
                    platform=platform,
                    recipient_id=str(data.get('delivery_jid') or sender_id or data.get('sender_id') or data.get('chat_id') or ''),
                    image_urls=image_urls,
                    captions=captions,
                    agent_config=agent_config,
                    message_text=parsed_ai.get('reply', '').strip() or 'নিচে পণ্যের ছবি দেওয়া হলো:',
                    product=product,
                    card_items=image_items,
                )
                if route_result.get('status') == 'success':
                    logger.info(
                        'product_gallery_images_delivered product_id=%s variant_id=%s image_count=%s',
                        product.id, variant_id, len(image_items)
                    )
                    # Record delivered product_id in UserMemory so AI knows images were already delivered in chat
                    try:
                        user_mem = _get_or_create_user_memory(agent_config, sender_id)
                        m_data = user_mem.data or {}
                        m_internal = m_data.get('_internal', {})
                        sent_pids = m_internal.get('images_sent_product_ids', [])
                        if product.id not in sent_pids:
                            sent_pids.append(product.id)
                            m_internal['images_sent_product_ids'] = sent_pids[-20:]
                            m_data['_internal'] = m_internal
                            user_mem.data = m_data
                            user_mem.save(update_fields=['data'])
                    except Exception as track_err:
                        logger.warning('Failed tracking sent image product id: %s', track_err)
                    return True, route_result
    except Exception as product_image_err:
        logger.warning('product_gallery_delivery_failed error=%s', type(product_image_err).__name__)

    if image_ids:
        try:
            from embedding.models import RowImage
            from datasheet.views import RowImagePresignedURLView
            
            selected_imgs = list(RowImage.objects.filter(id__in=image_ids, user=agent_config.user))
            if selected_imgs:
                view_obj = RowImagePresignedURLView()
                presigned_data = []
                for img in selected_imgs:
                    p_url = view_obj._generate_presigned_url(img.image_url, expiration=60)
                    presigned_data.append({
                        'url': p_url,
                        'caption': _clean_caption_for_user(img.image_caption),
                        'image_id': img.id
                    })
                
                image_urls = [i['url'] for i in presigned_data if i.get('url')]
                captions = [i['caption'] for i in presigned_data if i.get('url')]
                if image_urls:
                    message_text = parsed_ai.get('reply', '').strip() or None
                    route_result = route_images(
                        platform=platform,
                        recipient_id=str(data.get('delivery_jid') or sender_id or data.get('sender_id') or data.get('chat_id') or ''),
                        image_urls=image_urls,
                        captions=captions,
                        agent_config=agent_config,
                        message_text=message_text
                    )
                    if route_result.get('status') == 'success':
                        logger.info(f'✅ Direct AI Image ID delivery succeeded for {platform} IDs: {image_ids}')
                        return True, route_result
        except Exception as id_err:
            logger.warning(f'Direct image_ids delivery failed: {id_err}')

    sheet_id, row_index = _parse_sheet_row_id(best_row_id)
    if sheet_id is None or row_index is None:
        try:
            from aiAgent.models import UserMemory
            from embedding.models import RowImage
            from django.db.models import Q
            mem = UserMemory.objects.filter(ai_agent=agent_config, sender_id=str(sender_id or '').lower()).first()
            active_p = ((mem.data or {}).get('_internal', {}) if mem else {}).get('recent_order_interest', {}).get('product_name')
            if active_p:
                tokens = [t.lower() for t in str(active_p).split() if len(t) > 2]
                q_filter = Q()
                for tok in tokens:
                    q_filter |= Q(image_caption__icontains=tok) | Q(image_filename__icontains=tok)
                matched_row = RowImage.objects.filter(user=agent_config.user).filter(q_filter).first()
                if matched_row and matched_row.row_id:
                    sheet_id, row_index = _parse_sheet_row_id(matched_row.row_id)
                    logger.info(f"🧠 [Image Delivery Memory Fallback] Resolved {matched_row.row_id} for '{active_p}'")
        except Exception as fallback_err:
            logger.warning(f"RowImage fallback lookup error: {fallback_err}")

    if sheet_id is None or row_index is None:
        logger.warning('Image intent requested but no valid matched sheet row available.')
        return False, None

    try:
        tool_result = execute_image_delivery_tool(
            user_id=agent_config.user.id,
            sheet_id=sheet_id,
            tool_params={
                'row_index': row_index,
                'platform': platform,
                'limit': 3,
            },
            agent_config=agent_config
        )
        if tool_result.get('status') != 'success':
            logger.warning(f'Image delivery tool failed: {tool_result.get('message')}')
            return False, None

        images = tool_result.get('images', []) or []
        image_urls = [img.get('url') for img in images if img.get('url')]
        captions = [_clean_caption_for_user(img.get('caption') or '') for img in images if img.get('url')]
        if not image_urls:
            logger.warning('Image delivery tool returned no image URLs.')
            return False, None

        message_text = parsed_ai.get('reply', '').strip() or None
        if parsed_ai.get('image_style') == 'image_only':
            if not message_text:
                message_text = 'Here are the requested product images.'

        route_result = route_images(
            platform=platform,
            recipient_id=str(data.get('delivery_jid') or sender_id or data.get('sender_id') or data.get('chat_id') or ''),
            image_urls=image_urls,
            captions=captions,
            agent_config=agent_config,
            message_text=message_text
        )

        if route_result.get('status') == 'success':
            logger.info(f'Image delivery succeeded for {platform} row {row_index}')
            return True, route_result
        logger.warning(f'Image delivery routing failed: {route_result}')
        return False, route_result
    except Exception as e:
        logger.error(f'Image delivery exception: {e}', exc_info=True)
        return False, None


def _get_or_create_user_memory(agent_config, sender_id):
    sender_id_norm = str(sender_id).lower() if sender_id else sender_id
    memory, _ = UserMemory.objects.get_or_create(ai_agent=agent_config, sender_id=sender_id_norm)
    data = memory.data or {}
    internal = data.get('_internal', {})
    internal.setdefault('order_state', 'idle')
    internal.setdefault('order_fields', {})
    internal.setdefault('failed_attempts', {})
    internal.setdefault('interruption_buffer', {'active': False})
    internal.setdefault('recent_order_interest', {})
    data['_internal'] = internal
    if memory.data != data:
        memory.data = data
        memory.save(update_fields=['data'])
    return memory


def _increment_field_failure(user_memory, field_name, attempted_value=None):
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    failed_attempts = internal.get('failed_attempts', {})
    stats = failed_attempts.get(field_name, {
        'count': 0,
        'last_values': [],
        'strike_context': 0,
        'last_attempt_at': None,
        'escalated': False
    })
    stats['count'] = stats.get('count', 0) + 1
    stats['strike_context'] = min(3, stats['count'])
    last_values = stats.get('last_values', []) or []
    if attempted_value is not None:
        last_values.append(str(attempted_value))
        stats['last_values'] = last_values[-3:]
    stats['last_attempt_at'] = timezone.now().isoformat()
    failed_attempts[field_name] = stats
    internal['failed_attempts'] = failed_attempts
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])
    return stats


def _get_first_escalation_field(user_memory):
    if not user_memory or not user_memory.data:
        return None
    failed_attempts = user_memory.data.get('_internal', {}).get('failed_attempts', {})
    for field_name, stats in failed_attempts.items():
        if stats.get('count', 0) >= 3 and not stats.get('escalated', False):
            return field_name, stats
    return None


def _mark_field_escalated(user_memory, field_name):
    if not user_memory or not user_memory.data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    failed_attempts = internal.get('failed_attempts', {})
    stats = failed_attempts.get(field_name)
    if stats:
        stats['escalated'] = True
        failed_attempts[field_name] = stats
        internal['failed_attempts'] = failed_attempts
        data['_internal'] = internal
        user_memory.data = data
        user_memory.save(update_fields=['data'])


def _trigger_order_fallback_escalation(agent_config, sender_id, failed_field, last_values, contact_name=None):
    from aiAgent.models import Contact
    from chat.models import Notification
    from users.services.email_service import send_order_fallback_alert_email

    contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
    if contact_obj:
        contact_obj.is_human_needed = True
        contact_obj.save(update_fields=['is_human_needed'])
        contact_name = contact_obj.name or contact_obj.push_name or sender_id
    else:
        contact_name = contact_name or sender_id

    try:
        Notification.objects.create(
            user=agent_config.user,
            message=(
                f"Order parsing failed after 3 attempts for sender {sender_id}. "
                f"Problematic field: {failed_field}. Last attempts: {', '.join(last_values or [])}. "
                "The conversation has been flagged for human review."),
            type='order_fallback_alert'
        )
    except Exception as e:
        logger.error(f"Failed to create fallback notification: {e}", exc_info=True)

    try:
        if agent_config.user.email:
            send_order_fallback_alert_email(
                merchant_email=agent_config.user.email,
                sender_id=sender_id,
                failed_field=failed_field,
                last_values=last_values or [],
                contact_name=contact_name,
                agent_name=agent_config.user.get_full_name() or agent_config.user.email
            )
    except Exception as e:
        logger.error(f"Failed to send human fallback email: {e}", exc_info=True)

    # Persist fallback state in memory for this contact
    try:
        user_memory = _get_or_create_user_memory(agent_config, sender_id)
        _set_order_state(user_memory, 'human_fallback')
    except Exception as e:
        logger.error(f"Failed to persist human fallback memory state: {e}", exc_info=True)

    return contact_obj


ORDER_FIELDS = ['customer_name', 'phone_number', 'address', 'product_name', 'quantity', 'price', 'extra_info', 'product_id', 'district', 'upazila']


def _set_order_state(user_memory, state):
    if not user_memory or not user_memory.data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    internal['order_state'] = state
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _clear_order_fields(user_memory):
    if not user_memory or not user_memory.data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    internal['order_fields'] = {}
    internal['failed_attempts'] = {}
    internal['interruption_buffer'] = {'active': False}
    internal['order_state'] = 'idle'
    internal.pop('last_image_caption', None)
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _get_order_fields(user_memory):
    if not user_memory or not user_memory.data:
        return {}
    return user_memory.data.get('_internal', {}).get('order_fields', {})


def _get_collected_order_fields(user_memory):
    """Return collected order fields that have a value with confidence >= 0.75."""
    return _get_plain_order_values(user_memory)


def _get_plain_order_values(user_memory):
    fields = _get_order_fields(user_memory)
    values = {
        field: fields.get(field, {}).get('value')
        for field in ORDER_FIELDS
        if fields.get(field, {}).get('value') and fields.get(field, {}).get('confidence', 1.0) >= 0.75
    }
    if 'items' in fields:
        values['items'] = fields['items'].get('value')
    return values


def _hydrate_order_from_catalog(user, order_data):
    hydrated = dict(order_data or {})
    items = hydrated.get('items')
    if isinstance(items, list) and len(items) > 0:
        hydrated_items = []
        total_price = 0.0
        for item in items:
            if not isinstance(item, dict):
                continue
            i_name = item.get('name') or item.get('product_name')
            if not i_name:
                continue
            i_qty = 1
            for q_key in ['quantity', 'qty', 'count']:
                if q_key in item:
                    try:
                        i_qty = int(item[q_key])
                        break
                    except Exception:
                        pass
            cat_prod = _resolve_catalog_product_for_user(user, i_name, i_qty)
            canonical_name = cat_prod.get('name', i_name) if cat_prod else i_name
            cat_price = float(cat_prod.get('price') or 0.0) if cat_prod else float(item.get('price') or 0.0)
            total_price += cat_price * i_qty
            hydrated_items.append({
                'name': canonical_name,
                'quantity': i_qty,
                'price': cat_price
            })
        if hydrated_items:
            hydrated['items'] = hydrated_items
            if total_price > 0:
                hydrated['price'] = str(total_price)
            if not hydrated.get('quantity'):
                hydrated['quantity'] = sum(i['quantity'] for i in hydrated_items)

    product_name = hydrated.get('product_name')
    if product_name:
        quantity = hydrated.get('quantity') or 1
        product = _resolve_catalog_product_for_user(user, product_name, quantity)
        if product:
            hydrated['product_name'] = product.get('name', product_name)
            if product.get('price') is not None and not hydrated.get('price'):
                hydrated['price'] = str(product.get('price'))
    return hydrated


def _save_recent_order_interest(user_memory, product_name=None, price=None, source_text=None):
    if not user_memory or not product_name:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    recent_interest = {
        'product_name': str(product_name).strip(),
        'updated_at': timezone.now().isoformat(),
        'source': 'recent_chat',
    }
    if price is not None:
        recent_interest['price'] = str(price)
    if source_text:
        recent_interest['source_text'] = str(source_text)[:300]
    internal['recent_order_interest'] = recent_interest
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _get_recent_order_interest(user_memory):
    if not user_memory or not user_memory.data:
        return {}
    recent_interest = user_memory.data.get('_internal', {}).get('recent_order_interest') or {}
    if not recent_interest.get('product_name'):
        return {}
    return recent_interest


def _seed_order_data_from_recent_interest(user_memory, order_data=None):
    seeded = dict(order_data or {})
    recent_interest = _get_recent_order_interest(user_memory)
    if recent_interest and not seeded.get('product_name'):
        seeded['product_name'] = recent_interest.get('product_name')
    if recent_interest.get('price') and not seeded.get('price'):
        seeded['price'] = recent_interest.get('price')
    return seeded


def _infer_catalog_product_from_text(user, text):
    if not text:
        return None
    normalized, metadata = normalize_order_entities(user, {'product_name': text})
    if metadata.get('product_name'):
        # Ensure the inferred product actually exists in the merchant's catalog
        inferred_name = normalized.get('product_name')
        try:
            product = _validate_product_in_catalog(user, inferred_name, 1)
            if product:
                # Return the canonical product name from catalog to reduce mismatches
                return product.get('name') or inferred_name
        except Exception:
            # On any error during validation, don't return an inferred product
            return None
    return None


def _has_complete_order_fields(user_memory):
    fields = _get_order_fields(user_memory)
    for key in ORDER_FIELDS:
        if key in ['extra_info', 'price', 'district', 'upazila', 'product_id']:
            continue
        field_data = fields.get(key, {})
        if not field_data.get('value') or field_data.get('confidence', 1.0) < 0.75:
            return False
    return True


def _validate_product_in_catalog(user, product_name, quantity=1):
    """
    Check if product exists in user's catalog.
    Returns product dict if valid, None if invalid.
    """
    if not product_name:
        return None
    product = user.get_catalog_product(product_name, quantity)
    return product


def _is_product_valid_in_memory(user_memory, user):
    """
    Validate if the product saved in order memory exists in catalog.
    Returns True if valid, False if invalid.
    """
    fields = _get_order_fields(user_memory)
    product_name = fields.get('product_name', {}).get('value')
    quantity = fields.get('quantity', {}).get('value') or 1
    
    if not product_name:
        return False
    
    try:
        qty = int(str(quantity).strip())
    except (ValueError, TypeError):
        qty = 1
    
    product = _validate_product_in_catalog(user, product_name, qty)
    return product is not None


def _get_confirmation_prompt(user_memory):
    order_fields = _get_order_fields(user_memory)
    lines = ["আপনার অর্ডারের খসড়া নিচে দেখুন:"]
    
    # Check if we have multi-item order list
    items_field = order_fields.get('items', {}).get('value')
    has_multiple_items = isinstance(items_field, list) and len(items_field) > 1

    for key in ORDER_FIELDS:
        if key in ['district', 'upazila']:
            continue
        # extra_info is purely optional; do not show as an error/cross if absent
        if key == 'extra_info' and not order_fields.get(key, {}).get('value'):
            continue
        # If multi-item order, we format products and price customly below
        if has_multiple_items and key in ['product_name', 'quantity', 'price']:
            continue
            
        label = key.replace('_', ' ').title()
        field_data = order_fields.get(key, {})
        val = field_data.get('value')
        # Clean [অস্পষ্ট] marker if present so draft UI never shows raw internal tag
        if isinstance(val, str):
            val = val.replace('[অস্পষ্ট]', '').strip()
        value = val or 'মৌলিক তথ্য প্রয়োজন'
        status = '✅' if field_data.get('value') and field_data.get('confidence', 1.0) >= 0.75 else '❌'
        lines.append(f"{status} {label}: {value}")

    if has_multiple_items:
        lines.append("📦 Products:")
        total_price = 0.0
        for itm in items_field:
            if not isinstance(itm, dict):
                continue
            itm_name = itm.get('name') or itm.get('product_name') or 'Item'
            itm_qty = itm.get('quantity') or 1
            itm_price = float(itm.get('price') or 0.0)
            if itm_price > 0:
                lines.append(f"  • {itm_name} x {itm_qty} (৳{itm_price * itm_qty:g})")
                total_price += itm_price * itm_qty
            else:
                lines.append(f"  • {itm_name} x {itm_qty}")
        if total_price > 0:
            lines.append(f"💰 Total Price: ৳{total_price:g}")

    # Generate or reuse CheckoutSession link for 1-click rich card/button checkout
    checkout_url = None
    agent_platform = 'whatsapp'
    try:
        from aiAgent.business_logic.logic_handler import _get_checkout_url_for_contact
        from aiAgent.models import Contact
        agent = getattr(user_memory, 'ai_agent', None)
        sender_id = getattr(user_memory, 'sender_id', None)
        if agent and agent.user:
            agent_platform = (agent.platform or 'whatsapp').lower()
            contact = Contact.objects.filter(agent=agent, identifier=sender_id).first() if sender_id else None
            if contact:
                checkout_url = _get_checkout_url_for_contact(contact)
    except Exception as e:
        logger.warning(f"Failed to generate checkout session in confirmation prompt: {e}")

    if agent_platform in ['messenger', 'instagram', 'telegram']:
        lines.append("\n🛒 নিচের '🛒 অর্ডার' বাটনে ক্লিক করে খুব সহজেই ১-ক্লিকে অর্ডার সম্পন্ন করতে পারেন।")
    elif checkout_url:
        lines.append(f"\n🛒 নিচের লিংকে ক্লিক করে ডেলিভারি এরিয়া নির্বাচন করে ১-ক্লিকে অর্ডার কনফার্ম করুন:\n👉 {checkout_url}")
    else:
        lines.append("\n🛒 অর্ডার কনফার্ম করতে আপনার ডেলিভারি তথ্য সঠিক আছে কিনা দেখে নিশ্চিত করুন।")

    return "\n".join(lines)


def _save_order_fields_to_memory(user_memory, order_data, source='ai_extraction', field_metadata=None):
    if not user_memory or not order_data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    order_fields = internal.get('order_fields', {})

    field_metadata = field_metadata or {}
    for key, value in (order_data or {}).items():
        if key not in ORDER_FIELDS and key != 'items':
            continue
        if value is None:
            continue
            
        # Clean [অস্পষ্ট] marker if present so database never stores raw audio noise tag
        if isinstance(value, str):
            value = value.replace('[অস্পষ্ট]', '').strip()
            if not value and key in ['address', 'customer_name']:
                continue
            
        existing = order_fields.get(key, {})
        metadata = field_metadata.get(key, {})
        
        if key == 'items':
            order_fields[key] = {
                'value': value,  # Keep as list/dict
                'confidence': 1.0,
                'source': metadata.get('source', source),
                'updated_at': timezone.now().isoformat()
            }
        elif key == 'address':
            # Step 1: Preserve full_address 100% intact. Never truncate or replace raw details with just area name.
            old_addr = str(existing.get('value') or '').strip()
            new_addr = str(value).strip()
            if old_addr and new_addr and len(new_addr) < len(old_addr) and (new_addr in old_addr):
                # User sent shorter area name; preserve original detailed address
                chosen_addr = old_addr
            else:
                chosen_addr = new_addr or old_addr

            order_fields[key] = {
                'value': chosen_addr,
                'confidence': metadata.get('confidence', existing.get('confidence', 0.95 if source == 'regex_validated' else 0.85)),
                'source': metadata.get('source', source),
                'updated_at': timezone.now().isoformat()
            }
        else:
            val_str = str(value).strip()
            if key in ('phone_number', 'quantity'):
                bn_to_en = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')
                val_str = val_str.translate(bn_to_en)
                if key == 'phone_number':
                    digits = ''.join(ch for ch in val_str if '0' <= ch <= '9')
                    if digits.startswith('880') and len(digits) == 13:
                        digits = '0' + digits[3:]
                    elif len(digits) == 10 and digits.startswith('1'):
                        digits = '0' + digits
                    if digits:
                        val_str = digits
            order_fields[key] = {
                'value': val_str,
                'confidence': metadata.get('confidence', existing.get('confidence', 0.95 if source == 'regex_validated' else 0.85)),
                'source': metadata.get('source', source),
                'updated_at': timezone.now().isoformat()
            }
            if metadata.get('matched_from'):
                order_fields[key]['matched_from'] = metadata.get('matched_from')

    internal['order_fields'] = order_fields
    if internal.get('order_state') == 'idle' and order_fields:
        internal['order_state'] = 'ordering'
        internal.pop('last_image_caption', None)
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _get_next_missing_field(user_memory):
    if not user_memory or not user_memory.data:
        return None
    order_fields = _get_order_fields(user_memory)
    for key in ORDER_FIELDS:
        if key in ['extra_info', 'price']:
            continue
        field_data = order_fields.get(key, {})
        if not field_data.get('value') or field_data.get('confidence', 1.0) < 0.75:
            return key
    return None


def _set_interruption_buffer(user_memory, suspended_field):
    if not user_memory or not user_memory.data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    internal['interruption_buffer'] = {
        'active': True,
        'suspended_field': suspended_field,
        'suspended_state': internal.get('order_state', 'ordering'),
        'resumed': False,
        'created_at': timezone.now().isoformat()
    }
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _clear_interruption_buffer(user_memory):
    if not user_memory or not user_memory.data:
        return
    data = user_memory.data or {}
    internal = data.get('_internal', {})
    internal['interruption_buffer'] = {'active': False}
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])


def _get_interruption_resume_prompt(user_memory):
    if not user_memory or not user_memory.data:
        return None
    data = user_memory.data
    internal = data.get('_internal', {})
    buffer = internal.get('interruption_buffer', {})
    if not buffer.get('active') or buffer.get('resumed'):
        return None
    field = buffer.get('suspended_field') or _get_next_missing_field(user_memory)
    
    # Mark it as resumed so it isn't repeatedly prompted
    buffer['resumed'] = True
    internal['interruption_buffer'] = buffer
    data['_internal'] = internal
    user_memory.data = data
    user_memory.save(update_fields=['data'])

    if field:
        if field == 'order':
            return "আবার ফিরে আসছি — অনুগ্রহ করে উপরের অর্ডারের খসড়াটি কনফার্ম করুন।"
        label = field.replace('_', ' ')
        return f"আবার ফিরে আসছি — আপনার অর্ডারের পরবর্তী ধাপ হল: {label} দিন।"
    return "আবার ফিরে আসছি — আপনার অর্ডার পুনরায় শুরু করছি।"


def _is_active_unresumed_interruption(user_memory):
    if not user_memory or not user_memory.data:
        return False
    buffer = user_memory.data.get('_internal', {}).get('interruption_buffer', {})
    return bool(buffer.get('active') and not buffer.get('resumed'))


def _extract_plain_reply(ai_data):
    raw_reply = (ai_data or {}).get('reply', '') or ''
    json_match = re.search(r'\{.*\}', raw_reply, re.DOTALL)
    if json_match:
        try:
            parsed = json.loads(json_match.group())
            reply = str(parsed.get('reply') or '').strip()
            if reply:
                return reply
        except (json.JSONDecodeError, AttributeError, TypeError):
            pass
    return raw_reply.strip()


def _get_order_state(user_memory):
    if not user_memory or not user_memory.data:
        return 'idle'
    return user_memory.data.get('_internal', {}).get('order_state', 'idle')


def _order_confirmation_pending(user_memory):
    if not user_memory:
        return False
    return _get_order_state(user_memory) in ['awaiting_confirmation', 'editing']


def _get_missing_order_fields_prompt(user_memory):
    if not user_memory or not user_memory.data:
        return None
    order_fields = _get_order_fields(user_memory)
    missing = [
        field.replace('_', ' ')
        for field in ORDER_FIELDS
        if field not in ['extra_info', 'price', 'district', 'upazila'] and not order_fields.get(field, {}).get('value')
    ]
    if not missing:
        return None

    if _get_order_state(user_memory) == 'editing':
        return (
            "আপনার অর্ডার আপডেটের জন্য নিম্নলিখিত তথ্য দিন: "
            + ", ".join(missing)
            + "."
        )
    return (
        "আপনার অর্ডার সম্পূর্ণ করতে প্রয়োজন: "
        + ", ".join(missing)
        + "."
    )


def _queue_order_for_confirmation(agent_config, sender_id, request_type, data, order_data, msg_id=None, source='ai_extraction'):
    user_memory = _get_or_create_user_memory(agent_config, sender_id)
    current_text = str(data.get('message_text') or data.get('message') or '')
    merged_order = _merge_order_data_with_conversation(agent_config, sender_id, request_type, current_text, order_data)
    normalized_order, field_metadata = normalize_order_entities(agent_config.user, merged_order)
    normalized_order = _hydrate_order_from_catalog(agent_config.user, normalized_order)
    _save_order_fields_to_memory(user_memory, normalized_order, source=source, field_metadata=field_metadata)

    if user_memory and user_memory.data:
        internal = user_memory.data.get('_internal', {})
        if internal.get('interruption_buffer', {}).get('active'):
            _clear_interruption_buffer(user_memory)
            logger.info(f"🔁 Resumed interrupted order flow for {sender_id}.")

    if _has_complete_order_fields(user_memory):
        from courier.models import PathaoCourierConfig, SteadFastCourierConfig
        pathao_active = PathaoCourierConfig.objects.filter(user=agent_config.user, is_active=True).exists()
        steadfast_active = SteadFastCourierConfig.objects.filter(user=agent_config.user, is_active=True).exists()

        if not (pathao_active or steadfast_active):
            _set_order_state(user_memory, 'awaiting_confirmation')
            return _get_confirmation_prompt(user_memory)

        from courier.utils.redis_courier_cache import match_address_redis, query_autocomplete_zset, extract_location_from_address
        order_fields = _get_order_fields(user_memory)
        district_val = order_fields.get('district', {}).get('value')
        upazila_val = order_fields.get('upazila', {}).get('value')
        address_val = order_fields.get('address', {}).get('value')
        
        if not district_val or not upazila_val:
            ext_district, ext_upazila = extract_location_from_address(address_val)
            if not district_val:
                district_val = ext_district
            if not upazila_val:
                upazila_val = ext_upazila

        suggestions = match_address_redis(district_val, upazila_val, full_address=address_val)
        pathao_matched = suggestions.get('pathao', {}).get('city_id') and suggestions.get('pathao', {}).get('area_id')
        steadfast_matched = suggestions.get('steadfast', {}).get('city_id') and suggestions.get('steadfast', {}).get('area_id')

        is_valid_address = True
        suggest_from = []

        if pathao_active and steadfast_active:
            if not (pathao_matched or steadfast_matched):
                is_valid_address = False
                suggest_from = ["pathao", "steadfast"]
        elif pathao_active:
            if not pathao_matched:
                is_valid_address = False
                suggest_from = ["pathao"]
        elif steadfast_active:
            if not steadfast_matched:
                is_valid_address = False
                suggest_from = ["steadfast"]

        if not is_valid_address:
            prefix = str(upazila_val or "")[:4].strip().lower()
            closest_names = []
            if prefix:
                results = []
                if "pathao" in suggest_from:
                    results += query_autocomplete_zset("pathao:areas:ac", prefix)
                if "steadfast" in suggest_from:
                    results += query_autocomplete_zset("steadfast:areas:ac", prefix)
                for res in results:
                    name = res.split(":")[0].title()
                    if name not in closest_names:
                        closest_names.append(name)
                    if len(closest_names) >= 4:
                        break
            
            if closest_names:
                internal = user_memory.data.get('_internal', {})
                internal['address_suggestions'] = closest_names
                internal['order_state'] = 'awaiting_address_clarification'
                user_memory.data['_internal'] = internal
                user_memory.save(update_fields=['data'])
                
                suggest_prompt = f"আপনার কুরিয়ার এরিয়া নিশ্চিত করতে নিচের সঠিক নম্বরটি লিখুন:\n"
                for idx, name in enumerate(closest_names, 1):
                    suggest_prompt += f"{idx}: {name}\n"
                return suggest_prompt

        _set_order_state(user_memory, 'awaiting_confirmation')
        return _get_confirmation_prompt(user_memory)
    return None


def _resolve_catalog_product_for_user(user, product_name, quantity=1):
    if not product_name:
        return None

    try:
        quantity_value = int(quantity)
    except (ValueError, TypeError):
        quantity_value = 1

    product = user.get_catalog_product(product_name, quantity_value)
    if not product:
        return None

    stock = product.get('stock')
    if stock is not None and stock < quantity_value:
        return None

    return product


def create_customer_order_from_memory(agent_config, sender_id, request_type, msg_id=None):
    user_memory = _get_or_create_user_memory(agent_config, sender_id)
    if not _has_complete_order_fields(user_memory):
        logger.warning(f"Cannot create order: incomplete memory fields for {sender_id}")
        return None

    input_fields = _get_plain_order_values(user_memory)
    
    # 💥 FIX: Seed missing product_name from recent_order_interest (from AI response context)
    seeded_fields = _seed_order_data_from_recent_interest(user_memory, input_fields)
    
    customer_name = str(seeded_fields.get('customer_name') or input_fields.get('customer_name') or sender_id).strip()
    product_name = str(seeded_fields.get('product_name') or input_fields.get('product_name') or 'Product').strip()
    address = str(seeded_fields.get('address') or input_fields.get('address') or '').strip()
    raw_phone_val = str(seeded_fields.get('phone_number') or input_fields.get('phone_number') or sender_id).strip()
    bn_to_en = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')
    ascii_phone = raw_phone_val.translate(bn_to_en)
    phone_digits = ''.join(ch for ch in ascii_phone if '0' <= ch <= '9')
    if phone_digits.startswith('880') and len(phone_digits) == 13:
        phone_digits = '0' + phone_digits[3:]
    elif len(phone_digits) == 10 and phone_digits.startswith('1'):
        phone_digits = '0' + phone_digits
    phone_number = phone_digits if len(phone_digits) == 11 else ascii_phone
    extra_info = str(seeded_fields.get('extra_info') or input_fields.get('extra_info') or '').strip()

    quantity = seeded_fields.get('quantity') or input_fields.get('quantity')
    try:
        quantity_value = int(str(quantity).strip()) if quantity is not None else 1
    except (ValueError, TypeError):
        quantity_value = 1

    items_array = seeded_fields.get('items') or input_fields.get('items') or []
    order_items_payload = []
    
    if isinstance(items_array, list) and len(items_array) > 0:
        total_price = 0
        resolved_items = []
        for item in items_array:
            item_name = item.get('name') or item.get('product_name')
            if not item_name: continue
            
            item_qty = 1
            for q_key in ['quantity', 'qty', 'count']:
                if q_key in item:
                    try:
                        item_qty = int(item[q_key])
                        break
                    except: pass
                    
            cat_prod = _resolve_catalog_product_for_user(agent_config.user, item_name, item_qty)
            if cat_prod:
                i_price = cat_prod.get('price') or 0
                total_price += i_price * item_qty
                resolved_items.append({
                    "name": cat_prod.get('name', item_name),
                    "quantity": item_qty,
                    "price": float(i_price)
                })
        
        if resolved_items:
            if len(resolved_items) == 1:
                product_name = resolved_items[0]['name']
            else:
                product_name = f"Multi-item Order ({len(resolved_items)} items)"
            price_value = total_price
            quantity_value = sum(i["quantity"] for i in resolved_items)
            order_items_payload = resolved_items
            product = True  # Bypass single product validation
        else:
            product = None
    else:
        raw_product = agent_config.user.get_catalog_product(product_name, 1)
        if raw_product:
            product = _resolve_catalog_product_for_user(agent_config.user, product_name, quantity_value)
            if not product:
                logger.warning(f"Catalog product {product_name} is out of stock (Requested: {quantity_value})")
                return None
        else:
            product = None
    
    # 💥 FALLBACK: If product still not found, search conversation history for product mentions
    if not product and product_name == 'Product':
        try:
            history = get_last_message(agent_config, sender_id, limit=10, platform=request_type)
            conversation_text = " ".join([msg.get('content', '') for msg in history])
            
            inferred_product = _infer_catalog_product_from_text(agent_config.user, conversation_text)
            if inferred_product:
                logger.info(f"💡 Product inferred from conversation history: {inferred_product}")
                product_name = inferred_product
                raw_product = agent_config.user.get_catalog_product(product_name, 1)
                if raw_product:
                    product = _resolve_catalog_product_for_user(agent_config.user, product_name, quantity_value)
                    if not product:
                        logger.warning(f"Catalog product {product_name} is out of stock (Requested: {quantity_value})")
                        return None
                else:
                    product = None
        except Exception as hist_err:
            logger.warning(f"Failed to search conversation history for product: {hist_err}")
    
    if not product:
        # Fallback: if product is not found in catalog, construct a dummy product dict
        # using the product_name and price from memory so order creation doesn't fail!
        memory_price = input_fields.get('price') or seeded_fields.get('price')
        try:
            m_price_val = float(str(memory_price).strip()) if memory_price is not None else 0.0
        except Exception:
            m_price_val = 0.0
        product = {
            'name': product_name,
            'price': m_price_val
        }

    if not order_items_payload:
        is_catalog_product = product and 'stock' in product
        if is_catalog_product:
            unit_price = product.get('price') or 0
        else:
            memory_price = input_fields.get('price') or seeded_fields.get('price')
            try:
                m_price_val = float(str(memory_price).strip()) if memory_price is not None else None
            except Exception:
                m_price_val = None

            if m_price_val is not None:
                unit_price = m_price_val
            else:
                unit_price = product.get('price') or 0 if isinstance(product, dict) else 0

        price_value = unit_price
        product_name = product.get('name', product_name) if isinstance(product, dict) else product_name

    source_platform = request_type if request_type != 'web_widget' else 'web'

    try:
        # Match courier details for active couriers to save on the order object
        from courier.models import PathaoCourierConfig, SteadFastCourierConfig
        from courier.utils.redis_courier_cache import match_address_redis, extract_location_from_address
        
        pathao_active = PathaoCourierConfig.objects.filter(user=agent_config.user, is_active=True).exists()
        steadfast_active = SteadFastCourierConfig.objects.filter(user=agent_config.user, is_active=True).exists()
        
        # Read locked courier IDs and canonical matched names from memory first (locked during live courier validation)
        from aiAgent.tools.courier_validation_tool import get_active_courier_for_merchant
        active_provider = get_active_courier_for_merchant(agent_config.user)
        internal_mem = (user_memory.data or {}).get('_internal', {})
        all_saved_locs = internal_mem.get('courier_location_ids') or {}
        saved_loc_ids = all_saved_locs.get(active_provider) or {}
        saved_matched_names = internal_mem.get('courier_matched_names') or {}

        city_id = saved_loc_ids.get('city_id')
        zone_id = saved_loc_ids.get('zone_id')
        area_id = saved_loc_ids.get('area_id')

        district_val = saved_matched_names.get('city') or input_fields.get('district')
        upazila_val = saved_matched_names.get('zone') or input_fields.get('upazila')
        address_val = input_fields.get('address')

        # Only fallback to heuristic/cache matcher if live tool IDs were never locked in memory
        if not city_id:
            if not district_val or not upazila_val:
                ext_district, ext_upazila = extract_location_from_address(address_val)
                if not district_val:
                    district_val = ext_district
                if not upazila_val:
                    upazila_val = ext_upazila

            suggestions = match_address_redis(district_val, upazila_val, full_address=address_val)
            if active_provider == 'pathao' and pathao_active:
                city_id = suggestions.get('pathao', {}).get('city_id')
                zone_id = suggestions.get('pathao', {}).get('zone_id')
                area_id = suggestions.get('pathao', {}).get('area_id')
            elif active_provider == 'steadfast' and steadfast_active:
                city_id = suggestions.get('steadfast', {}).get('city_id')
                area_id = suggestions.get('steadfast', {}).get('area_id')

        # Unified Customer storefront account linking
        contact_obj = None
        customer_obj = None
        try:
            from aiAgent.models import Contact
            from storefront.models import CustomerIdentity, CustomerAddress
            contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
            identity = CustomerIdentity.objects.filter(
                agent=agent_config,
                platform=source_platform.lower(),
                platform_user_id=sender_id
            ).select_related('customer').first()
            if identity:
                customer_obj = identity.customer
                if address:
                    CustomerAddress.objects.update_or_create(
                        customer=customer_obj,
                        phone=phone_number or '',
                        defaults={
                            'recipient_name': customer_name or getattr(customer_obj, 'name', '') or '',
                            'full_address': address,
                            'district': district_val or '',
                            'upazila': upazila_val or '',
                            'courier_location_ids': all_saved_locs if isinstance(all_saved_locs, dict) else {},
                            'is_default': True,
                        }
                    )
        except Exception as e:
            logger.warning(f"Error resolving customer identity for AI order: {e}")

        order = CustomerOrder.objects.create(
            user=agent_config.user,
            customer=customer_obj,
            contact=contact_obj,
            customer_name=customer_name,
            phone_number=phone_number,
            district=district_val,
            upazila=upazila_val,
            address=address,
            product_name=product_name,
            price=price_value,
            item_quantity=quantity_value,
            items=order_items_payload,
            extra_info=extra_info,
            courier=active_provider,
            source_platform=source_platform,
            source_contact_id=sender_id,
            city_id=city_id,
            zone_id=zone_id,
            area_id=area_id,
            call_status='uncalled'
        )

        # Trigger auto-courier dispatch if enabled for merchant
        try:
            from courier.services.auto_dispatcher import attempt_auto_courier_booking
            auto_book_res = attempt_auto_courier_booking(order)
            logger.info("📦 [AutoCourierDispatch] Order #%s booking status: %s", order.id, auto_book_res.get('status'))
        except Exception as courier_book_err:
            logger.warning("Error attempting auto courier booking for Order #%s: %s", order.id, courier_book_err)

        if msg_id:
            r.setex(f'order_created:{msg_id}', 86400, '1')
        _clear_order_fields(user_memory)
        _set_order_state(user_memory, 'idle')
        logger.info(f"Created CustomerOrder #{order.id} from memory-confirmed order with inferred product: {product_name}")
        return order
    except Exception as e:
        logger.error(f"Memory-based AI order creation failed: {e}", exc_info=True)
        return None


def handle_order_button_action(agent_config, contact, action, page_id, platform):
    from aiAgent.business_logic.logic_handler import deliver_whatsapp_reply, deliver_instagram_reply, deliver_facebook_reply, deliver_telegram_reply

    sender_id = contact.identifier
    user_memory = _get_or_create_user_memory(agent_config, sender_id)
    response_text = None
    reply_data = {'sender_id': sender_id, 'message_id': '', 'sessionId': f"user_{agent_config.user.id}"}

    if platform == 'whatsapp':
        reply_data['delivery_jid'] = sender_id
    elif platform == 'telegram':
        reply_data['chat_id'] = sender_id
    elif platform in ['messenger', 'facebook_comment', 'instagram']:
        reply_data['page_id'] = page_id
        reply_data['page_access_token'] = agent_config.access_token

    if action == 'CONFIRM_ORDER':
        order = create_customer_order_from_memory(agent_config, sender_id, platform)
        if order:
            response_text = f"✅ আপনার অর্ডার #{order.id} নিশ্চিত করা হয়েছে। ইনভয়েস শীঘ্রই পাঠানো হবে।"
        else:
            from aiAgent.business_logic.logic_handler import _get_checkout_url_for_contact
            checkout_url = _get_checkout_url_for_contact(contact)
            if checkout_url:
                response_text = (
                    "অর্ডার কনফার্ম করার জন্য আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা প্রয়োজন।\n\n"
                    f"🛒 নিচের লিংকে ক্লিক করে খুব সহজেই ১-ক্লিকে অর্ডার সম্পন্ন করতে পারেন:\n👉 {checkout_url}\n\n"
                    "(অথবা চাইলে এখানে চ্যাটেও আপনার নাম, মোবাইল নম্বর এবং পূর্ণ ঠিকানা লিখে পাঠাতে পারেন)"
                )
            else:
                response_text = "দুঃখিত, আপনার অর্ডার নিশ্চিত করতে নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা প্রয়োজন। অনুগ্রহ করে আপনার তথ্য লিখে পাঠান।"
    elif action == 'EDIT_ORDER':
        _set_order_state(user_memory, 'editing')
        current_summary = _get_confirmation_prompt(user_memory)
        response_text = (
            "ঠিক আছে! আপনি কোন তথ্য আপডেট করতে চান? নিচে আপনার বর্তমান অর্ডার খসড়া দেখুন:\n\n"
            + current_summary
            + "\n\nআপডেট করতে চান এমন ক্ষেত্রটি লিখুন অথবা নির্দিষ্ট প্রয়োজনীয় তথ্য দিন।"
        )
    elif action == 'CANCEL_ORDER':
        _clear_order_fields(user_memory)
        response_text = "আপনার অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে আবার নতুন করে শুরু করতে পারেন।"
    else:
        return False

    if not response_text:
        return False

    delivered = False
    if platform == 'whatsapp':
        delivered = deliver_whatsapp_reply(reply_data, response_text)
    elif platform == 'instagram':
        delivered = deliver_instagram_reply(reply_data, response_text, page_id, agent_config.access_token)
    elif platform == 'telegram':
        delivered = deliver_telegram_reply(reply_data, response_text, agent_config.access_token)
    else:
        delivered = deliver_facebook_reply(reply_data, response_text, page_id, agent_config.access_token)

    return delivered


def _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj):
    """Send one periodic voice hint when control buttons are delivered externally."""
    if not contact_obj or request_type not in BUTTON_VOICE_PLATFORMS:
        return False

    voice_file = os.getenv("BUTTON_CONTROL_VOICE_FILE", "on-human-mode.wav")
    ttl_seconds = int(os.getenv("BUTTON_CONTROL_VOICE_TTL_SECONDS", str(30 * 24 * 60 * 60)))
    cache_key = f"button_voice_hint_sent:{contact_obj.id}:{request_type}:{voice_file}"

    try:
        if r.get(cache_key):
            return False

        from aiAgent.business_logic.logic_handler import send_voice_notification

        token = effective_access_token if request_type == 'telegram' else None
        success = send_voice_notification(
            sender_id=sender_id,
            platform=request_type,
            voice_file=voice_file,
            agent_data=data,
            page_id=page_id,
            access_token=effective_access_token,
            token=token
        )

        if success:
            r.setex(cache_key, ttl_seconds, "1")
        return success
    except Exception as e:
        logger.error(f"Failed to send button voice hint: {e}", exc_info=True)
        return False


def refresh_fb_page_token(fb_page):
    """Refresh long-lived user token and derive new page token when close to expiry."""
    if not fb_page or not fb_page.user_access_token:
        return None

    fb_app_id = getattr(settings, 'FB_APP_ID', None)
    fb_app_secret = getattr(settings, 'FB_APP_SECRET', None)
    if not fb_app_id or not fb_app_secret:
        logger.warning("FB app credentials missing; skip token refresh")
        return None

    try:
        # Refresh long-lived user token
        exchange_url = (
            "https://graph.facebook.com/v17.0/oauth/access_token?"
            f"grant_type=fb_exchange_token&client_id={fb_app_id}&client_secret={fb_app_secret}"
            f"&fb_exchange_token={fb_page.user_access_token}"
        )
        resp = requests.get(exchange_url, timeout=10).json()
        new_user_token = resp.get("access_token")
        expires_in = resp.get("expires_in")

        if new_user_token:
            fb_page.user_access_token = new_user_token
            fb_page.token_expires_at = timezone.now() + timedelta(seconds=expires_in) if expires_in else None
        else:
            logger.warning(f"FB user token refresh failed: {resp}")
            return None

        # Derive fresh page token using refreshed user token
        page_url = (
            f"https://graph.facebook.com/v17.0/{fb_page.page_id}?"
            f"fields=access_token&access_token={fb_page.user_access_token}"
        )
        page_resp = requests.get(page_url, timeout=10).json()
        new_page_token = page_resp.get("access_token")

        if new_page_token:
            fb_page.access_token = new_page_token
            fb_page.save(update_fields=["access_token", "user_access_token", "token_expires_at", "updated_at"])
            AgentAI.objects.filter(page_id=fb_page.page_id).update(access_token=new_page_token)
            logger.info(f"FB page token refreshed for page {fb_page.page_id}")
            return new_page_token
        else:
            logger.warning(f"FB page token refresh failed: {page_resp}")
    except Exception as e:
        logger.error(f"FB token refresh error: {e}")
    return None

def send_cache_update_ws(user_id, agent_id, sender_id=None, contact_id=None):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "CACHE_UPDATE",
                    "agent_id": agent_id, # Should be the string identifier (page_id)
                    "sender_id": sender_id,
                    "contact_id": contact_id,
                }
            }
        )
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")

def send_human_handoff_ws(user_id, agent_id, sender_id, contact_id, contact_name):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "HUMAN_HANDOFF",
                    "agent_id": agent_id, # Should be the string identifier (page_id)
                    "sender_id": sender_id,
                    "contact_id": contact_id,
                    "contact_name": contact_name
                }
            }
        )
        logger.info(f"🔊 Human handoff WebSocket notification sent for user_{user_id}")
    except Exception as e:
        logger.error(f"Human handoff WebSocket error: {e}")


def create_customer_order_from_ai(agent_config, sender_id, request_type, data, order_data, msg_id=None):
    if msg_id and r.get(f'order_created:{msg_id}'):
        logger.info(f"Duplicate AI order creation skipped for msg_id {msg_id}")
        return None

    if not isinstance(order_data, dict):
        logger.warning("Invalid order_data for AI order creation.")
        return None

    current_text = str(data.get('message_text') or '')
    order_data = _merge_order_data_with_conversation(agent_config, sender_id, request_type, current_text, order_data)

    customer_name = str(order_data.get('customer_name') or data.get('sender_name') or sender_id or '').strip()
    product_name = str(order_data.get('product_name') or order_data.get('item') or 'Product').strip()
    address = str(order_data.get('address') or order_data.get('delivery_address') or '').strip()
    phone_number = str(order_data.get('phone_number') or sender_id or '').strip()
    district = str(order_data.get('district') or '').strip()
    upazila = str(order_data.get('upazila') or '').strip()
    extra_info = str(order_data.get('extra_info') or order_data.get('notes') or data.get('message_text') or '').strip()

    if not customer_name or not product_name or not address:
        logger.warning("Incomplete AI order_data: missing required fields.")
        return None

    quantity = order_data.get('quantity')
    item_quantity = 1
    try:
        item_quantity = int(quantity) if quantity else 1
    except (ValueError, TypeError):
        item_quantity = 1

    items_array = order_data.get('items') or []
    order_items_payload = []
    
    if isinstance(items_array, list) and len(items_array) > 0:
        total_price = 0
        resolved_items = []
        for item in items_array:
            item_name = item.get('name') or item.get('product_name')
            if not item_name: continue
            
            item_qty = 1
            for q_key in ['quantity', 'qty', 'count']:
                if q_key in item:
                    try:
                        item_qty = int(item[q_key])
                        break
                    except: pass
                    
            cat_prod = _resolve_catalog_product_for_user(agent_config.user, item_name, item_qty)
            if cat_prod:
                i_price = cat_prod.get('price') or 0
                total_price += i_price * item_qty
                resolved_items.append({
                    "name": cat_prod.get('name', item_name),
                    "quantity": item_qty,
                    "price": float(i_price)
                })
        
        if resolved_items:
            product_name = f"Multi-item Order ({len(resolved_items)} items)"
            price = total_price
            item_quantity = sum(i["quantity"] for i in resolved_items)
            order_items_payload = resolved_items
            product = True  # Bypass single product validation
        else:
            product = None
    else:
        product = _resolve_catalog_product_for_user(agent_config.user, product_name, item_quantity)

    if not product:
        logger.warning(f"Catalog validation failed for product '{product_name}' and quantity {item_quantity} for user {agent_config.user.email}")
        return None

    if not order_items_payload:
        unit_price = product.get('price') or 0 if isinstance(product, dict) else 0
        price = unit_price * item_quantity
        product_name = product.get('name', product_name) if isinstance(product, dict) else product_name

    if quantity:
        try:
            quantity_value = int(quantity)
            extra_info = f"{extra_info} Quantity: {quantity_value}".strip()
        except (ValueError, TypeError):
            pass

    source_platform = request_type if request_type != 'web_widget' else 'web'
    source_contact_id = str(order_data.get('source_contact_id') or sender_id or '')

    # Unified Customer storefront account linking
    contact_obj = None
    customer_obj = None
    try:
        from aiAgent.models import Contact
        from storefront.models import CustomerIdentity
        contact_obj = Contact.objects.filter(agent=agent_config, identifier=source_contact_id).first()
        identity = CustomerIdentity.objects.filter(
            agent=agent_config,
            platform=source_platform.lower(),
            platform_user_id=source_contact_id
        ).select_related('customer').first()
        if identity:
            customer_obj = identity.customer
    except Exception as e:
        logger.warning(f"Error resolving customer identity for AI order intent: {e}")

    try:
        order = CustomerOrder.objects.create(
            user=agent_config.user,
            customer=customer_obj,
            contact=contact_obj,
            customer_name=customer_name,
            phone_number=phone_number,
            address=address,
            district=district,
            upazila=upazila,
            product_name=product_name,
            price=price,
            item_quantity=item_quantity,
            items=order_items_payload,
            extra_info=extra_info,
            source_platform=source_platform,
            source_contact_id=source_contact_id
        )

        if msg_id:
            r.setex(f'order_created:{msg_id}', 86400, '1')
        logger.info(f"Created CustomerOrder #{order.id} from AI order intent")
        return order
    except Exception as e:
        logger.error(f"AI order creation failed: {e}", exc_info=True)
        return None


def _extract_order_data_with_ai(agent_config, sender_id, text):
    """
    Use AI to extract order fields from text during editing mode.
    AI extracts ALL fields (not just missing ones), enabling field updates.
    Returns dict of extracted fields or empty dict on error.
    """
    if not text or not agent_config:
        return {}
    
    try:
        from aiAgent.gemini import generate_gemini_reply
        
        prompt = f"""Extract order field updates from this user message.
        
Message: '{text}'
        
Extract ANY of these fields if mentioned or updated (return only non-empty fields):
- customer_name: Full name
- phone_number: 10-11 digit Bangladesh phone (remove non-digits)
- address: Delivery address
- product_name: Product/item name
- quantity: Number (1-9999)
- price: Price in BDT (number only)
- extra_info: Special instructions or notes
- district: District in Bangladesh (e.g. Faridpur, Dhaka) parsed from the address or text
- upazila: Upazila/Thana in Bangladesh (e.g. Sadarpur, Mirpur) parsed from the address or text

Return ONLY a JSON object with extracted fields. Example:
{{
  "customer_name": "রহিম",
  "phone_number": "01712345678",
  "district": "Faridpur",
  "upazila": "Sadarpur"
}}

If no fields are mentioned, return: {{}}
Never return fields that weren't actually mentioned in the message."""
        

        
        ai_response = generate_gemini_reply(prompt, [], text, agent_config)
        if ai_response.get('status') == 'error' or not ai_response.get('reply'):
            return {}
        
        reply_text = ai_response.get('reply', '').strip()
        json_match = re.search(r'\{[^{}]*\}', reply_text)
        if not json_match:
            return {}
        
        extracted = json.loads(json_match.group())
        return {k: v for k, v in extracted.items() if k in ORDER_FIELDS and v}
    except Exception as e:
        logger.debug(f"AI order extraction failed: {e}")
        return {}


def extract_order_data_from_text(text, order_data=None, user_memory=None):
    """
    Validate and normalize structured order_data extracted by the AI.
    Does NOT use hardcoded keyword/regex guessing on raw user text; all intent
    and slot extraction are performed by the AI via order_protocol_dsl.
    """
    merged = dict(order_data or {})
    norm_text = _normalize_bengali_digits((text or '').strip())

    if user_memory is not None:
        if merged.get('phone_number'):
            valid_phone = validate_phone_number_bd(_normalize_bengali_digits(str(merged['phone_number'])))
            if valid_phone:
                merged['phone_number'] = valid_phone
            else:
                _increment_field_failure(user_memory, 'phone_number', merged.get('phone_number'))
                merged.pop('phone_number', None)

        if merged.get('quantity'):
            valid_qty = validate_quantity(_normalize_bengali_digits(str(merged['quantity'])), norm_text)
            if valid_qty is not None:
                merged['quantity'] = str(valid_qty)
            else:
                _increment_field_failure(user_memory, 'quantity', merged.get('quantity'))
                merged.pop('quantity', None)

        if merged.get('price'):
            valid_price = validate_price(_normalize_bengali_digits(str(merged['price'])))
            if valid_price is not None:
                merged['price'] = str(valid_price)
            else:
                _increment_field_failure(user_memory, 'price', merged.get('price'))
                merged.pop('price', None)

    return merged


def _merge_order_data_with_conversation(agent_config, sender_id, request_type, current_text, order_data):
    user_memory = _get_or_create_user_memory(agent_config, sender_id)
    merged = _seed_order_data_from_recent_interest(user_memory, order_data)
    merged = extract_order_data_from_text(current_text, merged, user_memory)
    if user_memory and _get_order_state(user_memory) in ['editing', 'awaiting_confirmation']:
        ai_updates = _extract_order_data_with_ai(agent_config, sender_id, current_text)
        if ai_updates:
            merged.update(ai_updates)
    if not merged.get('product_name'):
        inferred_product = _infer_catalog_product_from_text(agent_config.user, current_text)
        if inferred_product:
            merged['product_name'] = inferred_product

    normalized, _ = normalize_order_entities(agent_config.user, merged)
    return _hydrate_order_from_catalog(agent_config.user, normalized)


def _is_complete_order_data(order_data):
    if not isinstance(order_data, dict):
        return False
    # Note: `price` is not required; price is authoritative from merchant catalog
    required = ['customer_name', 'phone_number', 'address', 'product_name', 'quantity']
    for key in required:
        value = order_data.get(key)
        if value is None or str(value).strip() == '':
            return False
    return True


def _has_partial_order_data(order_data):
    if not isinstance(order_data, dict):
        return False
    present = {
        key for key in ['customer_name', 'phone_number', 'address', 'product_name', 'quantity', 'price']
        if order_data.get(key) is not None and str(order_data.get(key)).strip()
    }
    if {'customer_name', 'phone_number'} <= present:
        return True
    if {'phone_number', 'address'} <= present:
        return True
    return len(present) >= 3


@shared_task(bind=True, queue='chat_queue', max_retries=3)
def sync_contact_profile_picture(self, contact_id, platform, sender_id, page_id, token, data=None):
    from aiAgent.models import Contact
    from django.core.files.base import ContentFile
    import os, requests, hashlib, time
    from django.core.cache import cache
    
    cache_key = f"profile_sync_{contact_id}"
    if cache.get(cache_key):
        return  # Prevent continuous syncing
    
    try:
        contact = Contact.objects.get(id=contact_id)
        image_url = None
        
        if platform in ['messenger', 'facebook_comment', 'instagram'] and token:
            api_url = f"https://graph.facebook.com/v20.0/{sender_id}?fields=profile_pic,picture.type(large)&redirect=false&access_token={token}"
            resp = requests.get(api_url, timeout=10)
            if resp.status_code == 200:
                resp_json = resp.json()
                # Check for silhouette using the 'picture' edge which supports redirect=false
                if 'picture' in resp_json and 'data' in resp_json['picture']:
                    pic_data = resp_json['picture']['data']
                    if not pic_data.get('is_silhouette'):
                        image_url = pic_data.get('url')
                    else:
                        logger.info(f"⏭️ Skipping silhouette/default icon for {sender_id}")
                elif 'profile_pic' in resp_json:
                    # Fallback if picture edge fails
                    url = resp_json['profile_pic']
                    if 'silhouette' not in url and 'default_user' not in url.lower():
                        image_url = url
            else:
                logger.error(f"Graph API profile fetch failed for {sender_id}: {resp.text}")
                    
        elif platform == 'telegram' and token:
            api_url = f"https://api.telegram.org/bot{token}/getUserProfilePhotos?user_id={sender_id}&limit=1"
            resp = requests.get(api_url, timeout=10)
            if resp.status_code == 200:
                data_json = resp.json()
                photos = data_json.get('result', {}).get('photos', [])
                if photos and len(photos) > 0:
                    file_id = photos[0][-1]['file_id']
                    file_resp = requests.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}", timeout=10).json()
                    file_path = file_resp.get('result', {}).get('file_path')
                    if file_path:
                        image_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
                        
        elif platform == 'whatsapp' and data:
            # Check native payload for Baileys profile pic
            image_url = data.get('profilePicUrl') or data.get('profile_picture')
            
            # Baileys service fallback if URL missing natively
            if not image_url:
                try:
                    from openwa.models import WhatsAppInstance
                    wa_instance = WhatsAppInstance.objects.filter(user=contact.agent.user).first()
                    # Baileys sessionId pattern is user_{id}
                    baileys_session_id = f"user_{contact.agent.user.id}"
                    
                    if wa_instance and wa_instance.baileys_api_url:
                        base_url = wa_instance.baileys_api_url.rstrip('/')
                        # NEW Baileys Profile Endpoint: GET /profile/:sessionId/:jid
                        api_url = f"{base_url}/profile/{baileys_session_id}/{sender_id}"
                        
                        resp = requests.get(api_url, timeout=30)
                        if resp.status_code == 200:
                            resp_json = resp.json()
                            if resp_json.get('success') and resp_json.get('profilePictureUrl'):
                                url = resp_json.get('profilePictureUrl')
                                if url and 'default' not in url.lower():
                                    image_url = url
                except Exception as wa_err:
                    logger.error(f"WhatsApp Baileys profile fetch error: {wa_err}")
                    
        elif platform == 'youtube' and data:
            url = data.get('author_profile_image')
            if url and 'default_avatar' not in url.lower():
                image_url = url
            
        if not image_url:
            # Only throttle failures briefly so Telegram avatars can be retried soon
            cache_timeout = 300 if platform == 'telegram' else 86400
            cache.set(cache_key, "1", timeout=cache_timeout)
            return
            
        if contact.profile_photo_url != image_url:
            contact.profile_photo_url = image_url
            contact.save(update_fields=['profile_photo_url'])
            logger.info(f"✅ Saved new profile picture URL for contact {contact_id}: {image_url}")
        else:
            logger.info(f"⏭️ Profile picture URL for {contact_id} unchanged")
            
        # Cache success for 24h
        cache.set(cache_key, "1", timeout=86400)
            
    except Exception as e:
        logger.error(f"Profile picture sync failed for contact {contact_id}: {e}")

def _send_platform_buttons_alone(request_type, data, sender_id, page_id, effective_access_token, contact_obj):
    """Helper to send ONLY the buttons when the AI reply itself is skipped."""
    if not contact_obj:
        return
    try:
        sent = False
        if request_type == 'whatsapp':
            from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
            sent = send_whatsapp_buttons(data, contact_obj)
        elif request_type == 'instagram':
            from aiAgent.business_logic.logic_handler import send_instagram_buttons
            sent = send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj)
        elif request_type == 'telegram':
            from aiAgent.business_logic.logic_handler import send_telegram_buttons
            chat_id = data.get('chat_id') or sender_id
            sent = send_telegram_buttons(chat_id, effective_access_token, contact_obj)
        elif request_type in ['messenger', 'facebook_comment']:
            from aiAgent.business_logic.logic_handler import send_messenger_buttons
            sent = send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj)
        if sent:
            _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
    except Exception as e:
        logger.error(f"Failed to send standalone buttons: {e}")

def _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config, send_buttons=True):
    from aiAgent.models import Contact
    contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
    
    if request_type == 'whatsapp' or (agent_config and agent_config.platform == 'whatsapp'):
        # Safety Guard: Ensure sessionId is never empty for WhatsApp delivery
        if not data.get('sessionId') and not data.get('session_id'):
            if agent_config and agent_config.user:
                data['sessionId'] = f"user_{agent_config.user.id}"
            else:
                data['sessionId'] = 'default'
        else:
            data['sessionId'] = data.get('sessionId') or data.get('session_id')

        if not data.get('delivery_jid') and sender_id:
            data['delivery_jid'] = sender_id

        if send_buttons and contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
                delivered = send_whatsapp_buttons(data, contact_obj, reply_text=clean_reply)
                if delivered:
                    _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
                    return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_whatsapp_reply(data, clean_reply)
        return delivered

    elif request_type == 'instagram':
        if send_buttons and contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_instagram_buttons
                delivered = send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered:
                    _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
                    return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_instagram_reply(data, clean_reply, page_id, effective_access_token)
        if delivered and send_buttons and contact_obj:
            from aiAgent.business_logic.logic_handler import send_instagram_buttons
            buttons_sent = send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj)
            if buttons_sent:
                _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
        return delivered

    elif request_type == 'telegram':
        if send_buttons and contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_telegram_buttons
                delivered = send_telegram_buttons(data.get('chat_id') or sender_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered:
                    _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
                    return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_telegram_reply(data, clean_reply, effective_access_token)
        if delivered and send_buttons and contact_obj:
            from aiAgent.business_logic.logic_handler import send_telegram_buttons
            buttons_sent = send_telegram_buttons(data.get('chat_id') or sender_id, effective_access_token, contact_obj)
            if buttons_sent:
                _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
        return delivered

    elif request_type == 'youtube':
        from .youtube_tasks import deliver_youtube_final
        # For YouTube, we don't have interactive buttons yet, so just deliver the reply.
        delivered = deliver_youtube_final(data, clean_reply, agent_config)
        return delivered

    elif request_type == 'gbp':
        from .gbp_tasks import deliver_gbp_final
        delivered = deliver_gbp_final(data, clean_reply, agent_config)
        return delivered

    elif request_type == 'web_widget':
        # Web widget replies are handled by the dashboard delivery mechanism,
        # so no direct delivery here.
        return deliver_dashboard_reply(agent_config.user.id, clean_reply, data.get('message_id'))

    else: # This covers messenger and facebook_comment
        if request_type == 'messenger' and send_buttons and contact_obj and len(clean_reply or '') <= 600:
            try:
                from aiAgent.business_logic.logic_handler import send_messenger_buttons
                delivered = send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered:
                    _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
                    return True
            except Exception as e:
                logger.warning(f"Combined Messenger buttons failed: {e}")
        delivered = deliver_facebook_reply(data, clean_reply, page_id, effective_access_token)
        if delivered and send_buttons and contact_obj:
            from aiAgent.business_logic.logic_handler import send_messenger_buttons
            buttons_sent = send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj)
            if buttons_sent:
                _maybe_send_button_voice_hint(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
        return delivered

def deliver_dashboard_reply(user_id, reply, msg_id):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from aiAgent.models import DashboardAILog
        
        # 1 Log update
        log = DashboardAILog.objects.filter(user_id=user_id, message_id=msg_id).first()
        if log:
            log.answer = reply
            log.save()

        # ২. ওয়েব সকেটে পাঠাতে হবে
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "DASHBOARD_AI_REPLY",
                    "reply": reply,
                    "message_id": msg_id
                }
            }
        )
        return True
    except Exception as e:
        logger.error(f"Dashboard delivery error: {e}")
        return False

# -------------------- TASK -------------------- #

@shared_task(
             bind=True,
             queue='chat_queue',
             rate_limit='100/m',
             expires=180,
             autoretry_for=(requests.exceptions.RequestException, Exception),
             retry_backoff=True,
             max_retries=3,
             retry_jitter=True,
             time_limit=140,
             soft_time_limit=130
             )
def process_ai_reply_task(self, data):

    start_time = time.time()
    msg_trace_id = hashlib.sha256(f"{data.get('sender_id') or data.get('from') or ''}:{start_time}:{data.get('message_id') or ''}".encode()).hexdigest()[:12]
    data['_trace_id'] = msg_trace_id

    # 1. Platform Detection (Early)
    request_type = (data.get('platform') or data.get('type') or 'messenger').lower()
    
    # Extract sender_id: from (WhatsApp JID), phone (WA), or sender_id (FB)
    sender_id = str(data.get('sender_id') or data.get('from') or data.get('phone')).strip()

    # WhatsApp Channels/Newsletters are not customer conversations and must
    # never enter memory, RAG, cache, or AI response processing.
    normalized_sender = sender_id.lower()
    if normalized_sender.endswith('@newsletter') or normalized_sender.endswith('@broadcast'):
        logger.info("⏭️ [Task] Ignored WhatsApp channel/broadcast message sender=%s", normalized_sender)
        logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=SKIPPED reason=BROADCAST_CHANNEL", msg_trace_id, request_type, normalized_sender)
        return

    logger.info(f"🔍 [Task] Raw data received (Platform: {request_type}): {data}")
    
    # 2. Identifier Normalization (Safety)
    if request_type == 'whatsapp' and sender_id and isinstance(sender_id, str):
        # Enforce domain for phone-number IDs to prevent Messenger collision
        if '@' not in sender_id and sender_id.isdigit() and len(sender_id) > 7:
            sender_id = f"{sender_id}@s.whatsapp.net"
            logger.info(f"⚡ [Task] Appended domain to WA sender: {sender_id}")

    data['sender_id'] = sender_id  # Ensure it's available for delivery functions
    logger.info(f"🔍 [Task] Extracted sender_id: {sender_id} | Platform: {request_type}")
    page_id = data.get('page_id')
    # Detect platform refinement (if it was just a default or needs specific check)
    if request_type == 'messenger':
        # Check for WhatsApp indicators ( Baileys/EvolutionAPI fields or JIDs )
        if (data.get('receiver') or 
            data.get('sessionId') or 
            data.get('phone') or 
            (sender_id and isinstance(sender_id, str) and '@' in sender_id)):
            request_type = 'whatsapp'
        elif data.get('object') == 'instagram' or data.get('platform') == 'instagram':
            request_type = 'instagram'
        else:
            request_type = 'messenger'
    
    # Standardize names
    if request_type == 'fbmessenger': request_type = 'messenger'
    if request_type == 'fb_messenger': request_type = 'messenger'
    if request_type == 'whatsapp_baileys': request_type = 'whatsapp'

    # WhatsApp: normalize page_id to phone/session for lookup
    if request_type == 'whatsapp':
        cleaned_session = None
        if data.get('sessionId'):
            cleaned_session = str(data.get('sessionId')).replace('user_', '')
        
        page_candidates = [
            data.get('page_id'),
            data.get('pageId'),
            data.get('receiver'),
            data.get('to'),
            data.get('phone'),
            data.get('sessionId'),
            cleaned_session,
        ]

        best_candidate = None
        for candidate in page_candidates:
            if not candidate: continue
            cand_str = str(candidate).strip()
            if cand_str.lower() in ['undefined', 'null', 'none', '']: continue
            
            if not best_candidate:
                best_candidate = cand_str
            
            if best_candidate.startswith('user_') and any(char.isdigit() for char in cand_str):
                 best_candidate = cand_str
                 if cand_str[0].isdigit(): break

        if best_candidate:
            page_id = best_candidate

    if request_type == 'facebook_comment':
        text = data.get('comment_text') or data.get('message') or data.get('text')
    elif request_type == 'youtube':
        text = data.get('comment_text') or data.get('message') or data.get('text')
    else:
        # messenger or whatsapp
        text = data.get('message') or data.get('text') or data.get('body')

    message_type = str(data.get('message_type') or data.get('media_type') or '').lower()
    media_url = data.get('mediaUrl') or data.get('media_url') or data.get('image_url') or data.get('url')
    
    # Check for Baileys decrypted base64 media (from WhatsApp)
    media_base64 = (
        data.get('image_base64') or 
        data.get('video_base64') or 
        data.get('audio_base64') or 
        data.get('document_base64')
    )
    
    # If we have decrypted base64, convert it to a data URL for processing
    if media_base64 and not media_url:
        mime_type = data.get('mimetype') or 'application/octet-stream'
        # Create a data URL from base64
        media_url = f'data:{mime_type};base64,{media_base64}'
        logger.info(f"💾 [Webhook] Converted base64 media to data URL. MIME: {mime_type}, size: {len(media_base64)} chars")
    
    if not text and media_url:
        text = data.get('caption') or f"[{message_type.capitalize() or 'Media'} received]"
        data['message'] = text

    if message_type in ['image', 'video', 'audio', 'document'] and not media_url:
        logger.error(f"⛔ [Task] Media message missing payload. sender={sender_id}, page={page_id}, message_id={data.get('message_id')}, type={message_type}")
        if request_type == 'whatsapp':
            try:
                # Early normalization of sessionId for error message delivery
                if not data.get('sessionId') and not data.get('session_id'):
                    # Try to find user agent config to resolve user_id using global models
                    lookup_ids = [page_id, data.get('receiver'), data.get('phone'), data.get('to')]
                    lookup_ids = [str(x).split('@')[0] for x in lookup_ids if x]
                    agent_config = AgentAI.objects.filter(
                        Q(page_id__in=lookup_ids) | Q(number__in=lookup_ids),
                        is_active=True,
                        platform='whatsapp'
                    ).order_by('-id').first()
                    if agent_config:
                        data['sessionId'] = f"user_{agent_config.user.id}"
                
                if not data.get('delivery_jid') and sender_id:
                    data['delivery_jid'] = sender_id

                from aiAgent.business_logic.logic_handler import deliver_whatsapp_reply
                deliver_whatsapp_reply(data, "দুঃখিত, আপনার পাঠানো মিডিয়া আমাদের সিস্টেমে ঠিকঠাক পৌঁছাতে পারেনি। দয়া করে আবার পাঠান।")
            except Exception as e:
                logger.error(f"⚠️ [Task] Failed to send WhatsApp error reply: {e}")
        logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=ABORTED reason=CORRUPTED_MEDIA", msg_trace_id, request_type, sender_id)
        return

    msg_id = data.get('message_id')
    incoming_ts = data.get('timestamp')

    logger.info(
        "🚀 [MSG_START] trace_id=%s platform=%s sender_id=%s page_id=%s text='%s' media_type=%s message_id=%s",
        msg_trace_id, request_type, sender_id, page_id, (text or '').replace('\n', ' ')[:120], message_type or 'text', msg_id
    )

    if not all([sender_id, text, page_id]) and not media_url:
        logger.error(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}, page: {page_id}, media_url: {media_url}")
        logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=ABORTED reason=MISSING_CORE_DATA", msg_trace_id, request_type, sender_id)
        return

    # ২. এজেন্ট ও প্রোফাইল লোড
    agent_config = None
    try:
        if request_type == 'web_widget':
            agent_config = AgentAI.objects.filter(
                is_active=True,
                widget_key=data.get('widget_key'),
                platform='web_widget'
            ).first()
            lookup_ids = []
        elif request_type == 'whatsapp':
            # Priority: Bot's phone number, excluding sender or generic session strings
            candidates = [
                page_id,
                data.get('receiver'),
                data.get('phone'),
                data.get('to'),
            ]
            lookup_ids = []
            for c in candidates:
                if not c: continue
                val = str(c).split('@')[0]
                lookup_ids.append(val)
                if val.isdigit() and len(val) > 7:
                    lookup_ids.append(val)
        else:
            lookup_ids = [str(page_id)]

        lookup_ids = list(set([i for i in lookup_ids if i]))

        if not agent_config:
            # Check both page_id and number fields for WhatsApp
            if request_type == 'whatsapp':
                agent_config = AgentAI.objects.filter(
                    Q(page_id__in=lookup_ids) | Q(number__in=lookup_ids),
                    is_active=True,
                    platform='whatsapp'
                ).order_by('-id').first()
            elif request_type == 'instagram':
                agent_config = AgentAI.objects.filter(
                    is_active=True,
                    page_id__in=lookup_ids,
                    platform='instagram'
                ).order_by('-id').first()
            elif request_type == 'telegram':
                # Handle both custom bots and shared bot
                if page_id.startswith('shared_agent_'):
                    try:
                        agent_id = int(page_id.replace('shared_agent_', ''))
                        agent_config = AgentAI.objects.get(
                            id=agent_id,
                            is_active=True,
                            platform='telegram'
                        )
                    except (ValueError, AgentAI.DoesNotExist):
                        agent_config = None
                else:
                    agent_config = AgentAI.objects.filter(
                        is_active=True,
                        page_id__in=lookup_ids,
                        platform='telegram'
                    ).order_by('-id').first()
            elif request_type == 'youtube':
                agent_config = AgentAI.objects.filter(
                    is_active=True,
                    page_id__in=lookup_ids,
                    platform='youtube'
                ).order_by('-id').first()
            elif request_type == 'gbp':
                agent_config = AgentAI.objects.filter(
                    is_active=True,
                    page_id__in=lookup_ids,
                    platform='gbp'
                ).order_by('-id').first()
            else:
                agent_config = AgentAI.objects.filter(
                    is_active=True,
                    page_id__in=lookup_ids,
                    platform='messenger'
                ).order_by('-id').first()

        # Fallback for WhatsApp: Try lookup by user_id if we have it in sessionId
        if not agent_config and request_type == 'whatsapp' and data.get('sessionId'):
            try:
                u_id = str(data.get('sessionId')).replace('user_', '')
                if u_id.isdigit():
                    agent_config = AgentAI.objects.filter(
                        user_id=u_id,
                        platform='whatsapp',
                        is_active=True
                    ).order_by('-id').first()
            except:
                pass

        if not agent_config:
            logger.error(f'❌ [Task] No active agent found for identifiers {lookup_ids if lookup_ids else [page_id]}. identifiers checked: {lookup_ids}')
            logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=ABORTED reason=AGENT_NOT_FOUND", msg_trace_id, request_type, sender_id)
            return
        logger.info(
            "👤 [AGENT_RESOLVED] trace_id=%s agent_id=%s agent_name='%s' platform=%s merchant_id=%s merchant_email=%s",
            msg_trace_id, agent_config.id, agent_config.name, agent_config.platform, agent_config.user.id, agent_config.user.email
        )

        # Normalize WhatsApp delivery identity before any reply is sent to n8n.
        if request_type == 'whatsapp':
            def _non_empty(*values):
                for value in values:
                    if value is None:
                        continue
                    normalized = str(value).strip()
                    if normalized and normalized.lower() not in ('undefined', 'null', 'none'):
                        return normalized
                return ''

            resolved_session_id = _non_empty(data.get('sessionId'), data.get('session_id'))
            if not resolved_session_id:
                resolved_session_id = f"user_{agent_config.user.id}"

            resolved_delivery_jid = _non_empty(
                data.get('delivery_jid'), data.get('to'), data.get('sender_id'),
                data.get('from'), data.get('phone')
            )
            data['sessionId'] = resolved_session_id
            data['delivery_jid'] = resolved_delivery_jid
            if not data.get('sender_id') and resolved_delivery_jid:
                data['sender_id'] = resolved_delivery_jid
            logger.info(
                f"📤 [WhatsApp] Normalized delivery fields: "
                f"sessionId={resolved_session_id}, to={resolved_delivery_jid}"
            )
            if not resolved_delivery_jid:
                logger.error("❌ [WhatsApp] Cannot deliver reply: recipient/to is empty")
                logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=ABORTED reason=EMPTY_RECIPIENT", msg_trace_id, request_type, sender_id)
                return

        # Use matched agent page_id for downstream operations/cache keys
        if request_type == 'web_widget':
            page_id = f"widget_{agent_config.widget_key}"
        else:
            page_id = agent_config.page_id

        # ---- Image Support Check ----
        from users.models import Subscription
        from django.utils import timezone
        
        has_image_support = Subscription.objects.filter(
            profile=agent_config.user.profile,
            is_active=True,
            end_date__gt=timezone.now(),
            remaining_tokens__gt=0,
            offer__image_support=True
        ).exists()

        is_image_msg = (
            message_type == 'image' or 
            data.get('image_base64') or 
            (media_url and message_type == 'image')
        )
        if is_image_msg:
            
            if not has_image_support:
                msg = "দুঃখিত, এই মুহূর্তে আমাদের পেজে ছবি পাঠানোর সুবিধাটি বন্ধ রয়েছে। অনুগ্রহ করে বিস্তারিত টেক্সট লিখে আমাদের জানান।"
                logger.info(f"🚫 [Image Support Check] Blocked image message for user {agent_config.user.email} (No active subscription with image_support=True)")
                
                if request_type == 'whatsapp':
                    try:
                        if not data.get('sessionId') and not data.get('session_id'):
                            data['sessionId'] = f"user_{agent_config.user.id}"
                        if not data.get('delivery_jid') and sender_id:
                            data['delivery_jid'] = sender_id
                        from aiAgent.business_logic.logic_handler import deliver_whatsapp_reply
                        deliver_whatsapp_reply(data, msg)
                    except Exception as e:
                        logger.error(f"Failed to send WhatsApp image support error: {e}")
                elif request_type == 'web_widget':
                    pass
                else:
                    effective_access_token = None
                    if agent_config.access_token:
                        effective_access_token = agent_config.access_token
                    _deliver_reply_with_buttons(request_type, data, msg, sender_id, page_id, effective_access_token, agent_config)
                logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=ABORTED reason=NO_IMAGE_SUBSCRIPTION", msg_trace_id, request_type, sender_id)
                return
            
        user_profile = agent_config.user.profile

        from users.models import FacebookPage
        fb_page = FacebookPage.objects.filter(page_id=page_id, is_active=True).first() if page_id else None

        # Refresh token if close to expiry (<=5 days)
        if fb_page and fb_page.token_expires_at:
            remaining = fb_page.token_expires_at - timezone.now()
            if remaining <= timedelta(days=5):
                refreshed = refresh_fb_page_token(fb_page)
                if refreshed:
                    logger.info(f"FB token auto-refreshed for page {page_id}")

        effective_access_token = fb_page.access_token if fb_page else agent_config.access_token
        
        # 🔗 Telegram Token Lookup (Separate Model)
        if request_type == 'telegram':
            from aiAgent.models import TelegramBot
            # If shared bot, use shared token
            if page_id.startswith('shared_agent_'):
                shared_bot_token = getattr(settings, 'TELEGRAM_SHARED_BOT_TOKEN', None)
                if shared_bot_token:
                    effective_access_token = shared_bot_token
                    logger.info(f"Using shared bot token for agent {page_id}")
                else:
                    logger.error(f"No shared bot token configured for {page_id}")
                    effective_access_token = None
            else:
                # Custom bot - try to get from TelegramBot model
                tbot = TelegramBot.objects.filter(agent=agent_config, is_active=True).first()
                if tbot and tbot.bot_token:
                    effective_access_token = tbot.bot_token
                    logger.info(f"Using token from TelegramBot model for {page_id}")
                else:
                    logger.info(f"Falling back to AgentAI.access_token for {page_id}")

        # 🎙️ Voice Message Processing (Transcription using Gemini)
        is_audio = False
        mimetype = data.get('mimetype') or data.get('mime_type') or ''
        
        if (message_type == 'audio' or 
            mimetype.startswith('audio/') or 
            (media_url and media_url.startswith('data:audio/')) or
            data.get('audio_base64')):
            is_audio = True
        
        attachments = data.get('attachments') or []
        if isinstance(attachments, list) and len(attachments) > 0:
            for attach in attachments:
                if attach.get('type') == 'audio':
                    is_audio = True
                    media_url = attach.get('url') or attach.get('payload', {}).get('url') or media_url
                    break
        
        if request_type == 'telegram' and data.get('voice_file_id'):
            is_audio = True
            file_id = data.get('voice_file_id')
            try:
                import requests
                api_url = f"https://api.telegram.org/bot{effective_access_token}/getFile?file_id={file_id}"
                resp = requests.get(api_url, timeout=10).json()
                file_path = resp.get('result', {}).get('file_path')
                if file_path:
                    media_url = f"https://api.telegram.org/file/bot{effective_access_token}/{file_path}"
                    logger.info(f"🎙️ Telegram voice media URL resolved: {media_url}")
            except Exception as e:
                logger.error(f"❌ Failed to resolve Telegram voice file: {e}")

        if is_audio:
            logger.info(f"🎙️ Voice message detected from {sender_id} on {request_type}. Attempting transcription.")
            audio_bytes = None
            audio_mime = mimetype or 'audio/ogg'
            
            audio_base64 = data.get('audio_base64') or data.get('image_base64')
            
            if media_url and media_url.startswith('data:'):
                try:
                    header, encoded = media_url.split(',', 1)
                    audio_base64 = encoded
                    mime_part = header.split(';')[0]
                    audio_mime = mime_part.replace('data:', '')
                except Exception as e:
                    logger.error(f"Failed to parse data URL: {e}")

            if audio_base64:
                try:
                    import base64
                    audio_bytes = base64.b64decode(audio_base64)
                    if mimetype:
                        audio_mime = mimetype
                except Exception as e:
                    logger.error(f"Failed to decode audio base64: {e}")

            if not audio_bytes and media_url and not media_url.startswith('data:'):
                try:
                    logger.info(f"Downloading remote audio: {media_url}")
                    import requests
                    resp = requests.get(media_url, timeout=15)
                    if resp.status_code == 200:
                        audio_bytes = resp.content
                        audio_mime = resp.headers.get('content-type') or mimetype or 'audio/ogg'
                    else:
                        logger.error(f"Audio download failed with status {resp.status_code}")
                except Exception as e:
                    logger.error(f"Exception during remote audio download: {e}")

            if audio_bytes:
                clean_mime = audio_mime.split(';')[0].strip()
                if not clean_mime.startswith('audio/'):
                    clean_mime = 'audio/ogg'
                try:
                    from aiAgent.gemini import transcribe_audio_with_gemini
                    transcription = transcribe_audio_with_gemini(audio_bytes, clean_mime, agent_config)
                    if transcription:
                        logger.info(f"🎙️ Gemini Transcribed Text: '{transcription}'")
                        text = transcription
                        data['message'] = text
                    else:
                        logger.warning("🎙️ Gemini transcription returned empty.")
                except Exception as e:
                    logger.error(f"Error during Gemini transcription call: {e}")
            else:
                logger.error("🎙️ No audio bytes could be retrieved for transcription.")

            # Clear media fields so it doesn't fall through to image caption / search logic
            media_url = None
            message_type = 'text'
            data['mediaUrl'] = None
            data['media_url'] = None
            data['message_type'] = 'text'
            data.pop('image_base64', None)
            data.pop('audio_base64', None)

        # ── WhatsApp Message Logging (Incoming) ──
        wa_msg_obj = None
        if request_type == 'whatsapp':
            try:
                from openwa.models import WhatsAppInstance, WhatsAppMessage
                wa_instance, _ = WhatsAppInstance.objects.get_or_create(user=agent_config.user)
                wa_msg_obj = WhatsAppMessage.objects.create(
                    instance=wa_instance,
                    direction='incoming',
                    from_phone=sender_id,
                    message_text=text,
                    message_id=msg_id or '',
                    push_name=data.get('pushName', '')
                )
            except Exception as e:
                logger.error(f"WhatsApp Logging Error: {e}")

        # ── Contact Sync Logic (Auto-create or Update) ──
        from aiAgent.models import Contact
        # Check both camelCase (from Baileys) and snake_case (often from n8n)
        incoming_push_name = data.get('pushName') or data.get('push_name')
        contact_name = incoming_push_name or data.get('name')
        
        # If Messenger and name is missing, try fetching it from Facebook Graph API
        if not contact_name and request_type == 'messenger' and effective_access_token:
            contact_name = fetch_messenger_profile(sender_id, effective_access_token)

        # If Telegram and name is missing, pull from Telegram getChat
        if not contact_name and request_type == 'telegram' and effective_access_token:
            try:
                tg_resp = requests.get(
                    f"https://api.telegram.org/bot{effective_access_token}/getChat",
                    params={'chat_id': sender_id},
                    timeout=8
                ).json()
                if tg_resp.get('ok'):
                    chat_data = tg_resp.get('result', {})
                    full_name = " ".join(filter(None, [chat_data.get('first_name'), chat_data.get('last_name')])).strip()
                    contact_name = full_name or chat_data.get('username')
            except Exception as tg_err:
                logger.error(f"Telegram getChat name fetch failed: {tg_err}")

        # --- ROBUST CONTACT SYNC & STATE MIGRATION ---
        p_type = request_type if request_type in ['whatsapp', 'messenger', 'web_widget', 'facebook_comment', 'instagram', 'telegram', 'youtube'] else 'messenger'
        
        # 1. Primary Lookup: Full ID + Agent
        contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        
        # 2. Fallback Migration: If full ID not found, check for stripped ID (WhatsApp legacy)
        if not contact_obj and request_type == 'whatsapp' and '@' in str(sender_id):
            stripped_id = str(sender_id).split('@')[0]
            contact_obj = Contact.objects.filter(agent=agent_config, identifier=stripped_id).first()
            if contact_obj:
                logger.info(f"🔄 [Task] Migrating state for legacy contact: {stripped_id} -> {sender_id}")
                
                # Update identifier and migrate related models that use it as a string key
                old_id = contact_obj.identifier
                contact_obj.identifier = sender_id
                contact_obj.platform = 'whatsapp'
                
                try:
                    from chat.models import Conversation
                    from aiAgent.models import UserMemory
                    Conversation.objects.filter(agentAi=agent_config, contact_id=old_id, platform='whatsapp').update(contact_id=sender_id)
                    UserMemory.objects.filter(ai_agent=agent_config, sender_id=old_id).update(sender_id=sender_id)
                    logger.info(f"✅ [Task] Cascaded ID update complete for {sender_id}")
                except Exception as mig_err:
                    logger.error(f"❌ [Task] Related record migration failed: {mig_err}")
        
        # 3. Update or Create (Preserving existing flags if contact_obj exists)
        if contact_obj:
            contact_obj.name = contact_name or contact_obj.name
            contact_obj.push_name = incoming_push_name or contact_obj.push_name
            contact_obj.platform = p_type
            contact_obj.save()
            logger.info(f"✅ [Task] Contact sync: Updated {sender_id}")
        else:
            contact_obj = Contact.objects.create(
                agent=agent_config,
                identifier=sender_id,
                platform=p_type,
                name=contact_name,
                push_name=incoming_push_name
            )
            logger.info(f"✅ [Task] Contact sync: Created NEW {sender_id}")

        # ── Profile Picture Sync Trigger ──
        sync_contact_profile_picture.apply_async(args=[
            contact_obj.id, p_type, sender_id.lower(), page_id, effective_access_token, data
        ])

        # ── Message Logging & Dashboard Sync (Always) ──
        # Save early so even if AI doesn't reply (Human Mode), message is in history & dashboard
        user_msg_obj = save_message(agent_config, sender_id.lower(), text, 'user', platform=agent_config.platform)
        send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id)
        handle_smart_memory_update(agent_config, sender_id, text)

        user_memory = _get_or_create_user_memory(agent_config, sender_id)
        current_state = _get_order_state(user_memory)
        inferred_interest = _infer_catalog_product_from_text(agent_config.user, text)
        if inferred_interest and current_state == 'idle':
            interest_data = _hydrate_order_from_catalog(agent_config.user, {'product_name': inferred_interest})
            _save_recent_order_interest(
                user_memory,
                product_name=interest_data.get('product_name') or inferred_interest,
                price=interest_data.get('price'),
                source_text=text
            )

        mem_internal = (user_memory.data or {}).get('_internal', {})
        rec_prod = (mem_internal.get('recent_order_interest') or {}).get('product_name')
        last_viewed = mem_internal.get('last_viewed_product_ids', [])
        logger.info(
            "🧠 [MEMORY_STATE] trace_id=%s contact_id=%s contact_name='%s' identifier='%s' order_state=%s active_product='%s' last_viewed_ids=%s",
            msg_trace_id, contact_obj.id, contact_obj.name, contact_obj.identifier, current_state, rec_prod or 'none', last_viewed
        )

        if current_state == 'awaiting_address_clarification':
            clean_text = text.strip()
            suggestions = user_memory.data.get('_internal', {}).get('address_suggestions', [])
            
            selected_name = None
            if clean_text.isdigit():
                idx = int(clean_text) - 1
                if 0 <= idx < len(suggestions):
                    selected_name = suggestions[idx]
            else:
                for name in suggestions:
                    if clean_text.lower() in name.lower() or name.lower() in clean_text.lower():
                        selected_name = name
                        break
            
            if selected_name:
                order_fields = _get_order_fields(user_memory)
                if 'address' in order_fields:
                    order_fields['address']['value'] = f"{order_fields.get('address', {}).get('value', '')}, {selected_name}"
                if 'upazila' in order_fields:
                    order_fields['upazila'] = {'value': selected_name, 'confidence': 1.0}
                
                _save_order_fields_to_memory(user_memory, {k: v['value'] for k, v in order_fields.items() if v.get('value')})
                
                internal = user_memory.data.get('_internal', {})
                internal['order_state'] = 'ordering'
                if 'address_suggestions' in internal:
                    del internal['address_suggestions']
                user_memory.data['_internal'] = internal
                user_memory.save(update_fields=['data'])
                
                confirmation = _queue_order_for_confirmation(agent_config, sender_id, request_type, data, {}, msg_id=msg_id, source='clarification')
                if confirmation:
                    _deliver_reply_with_buttons(request_type, data, confirmation, sender_id, page_id, effective_access_token, agent_config)
                    if msg_id:
                        r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                        r.delete(f'processing_msg:{msg_id}')
                    return confirmation
            else:
                retry_prompt = "দুঃখিত, অনুগ্রহ করে সঠিক নম্বরটি লিখুন অথবা আপনার এরিয়ার নাম স্পষ্ট করে টাইপ করুন:\n"
                for idx, name in enumerate(suggestions, 1):
                    retry_prompt += f"{idx}: {name}\n"
                _deliver_reply_with_buttons(request_type, data, retry_prompt, sender_id, page_id, effective_access_token, agent_config)
                if msg_id:
                    r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                    r.delete(f'processing_msg:{msg_id}')
                return retry_prompt


        # Let the main AI loop handle entity extraction and ordering logic dynamically
        pass

        try:
            user_memory = _get_or_create_user_memory(agent_config, sender_id)
            escalation = _get_first_escalation_field(user_memory)
            if escalation:
                field_name, stats = escalation
                _mark_field_escalated(user_memory, field_name)
                contact_obj = _trigger_order_fallback_escalation(
                    agent_config=agent_config,
                    sender_id=sender_id,
                    failed_field=field_name,
                    last_values=stats.get('last_values', []),
                    contact_name=None
                )
                if contact_obj:
                    _send_platform_buttons_alone(request_type, data, sender_id, page_id, effective_access_token, contact_obj)
                if msg_id:
                    r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                    r.delete(f'processing_msg:{msg_id}')
                return "আমাদের সিস্টেম এই ফিল্ডটি বুঝতে পারছে না। একজন human agent শীঘ্রই আপনার সাথে যোগাযোগ করবেন।"
        except Exception as escalation_err:
            logger.error(f"Order escalation error: {escalation_err}", exc_info=True)
        
        # ── Auto-Reply Enable/Disable Check ──
        contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        if contact and (not contact.is_auto_reply_enabled or contact.is_human_needed):
            reason = "DISABLED" if not contact.is_auto_reply_enabled else "HUMAN_HANDOFF_ACTIVE"
            logger.info(f"🚫 Auto-reply is {reason} for contact {sender_id} (Agent: {agent_config.id}). Skipping AI response.")
            total_elapsed_ms = int((time.time() - start_time) * 1000)
            logger.info(
                "🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s agent_id=%s skipped_reason=%s total_time_ms=%s",
                msg_trace_id, request_type, sender_id, agent_config.id, reason, total_elapsed_ms
            )
            
            # Send buttons so user can easily restore AI
            _send_platform_buttons_alone(request_type, data, sender_id, page_id, effective_access_token, contact)
            
            if msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')
            if request_type == 'web_widget': return f"Auto-reply is currently {reason.lower()}."
            return
    except Exception as e:
        logger.error(f'Error: Agent not found for page_id {page_id} - {e}')
        logger.error(f'❌ [Task] Exception in pre-processing for page_id {page_id}: {e}', exc_info=True)
        return

    # ৩. পাবলিক কমেন্ট হ্যান্ডলিং এবং লুপ প্রোটেকশন
    should_continue, reason = handle_public_comment_logic(data, agent_config, r)
    if not should_continue:
        logger.info(f"⏭️ Task stopped: {reason}")
        logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=SKIPPED reason=PUBLIC_COMMENT_%s", msg_trace_id, request_type, sender_id, reason)
        return

    # ৪. ইডেমপোটেন্সি ও জম্বি চেক (Early Exit)
    if is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, r):
        logger.info("🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s status=SKIPPED reason=DUPLICATE_OR_OUTDATED", msg_trace_id, request_type, sender_id)
        return

    # ৫. Redis lock
    _, lock_key, lock_value = acquire_user_lock(self, r, sender_id)

    try:
        # ৬. ইনিশিয়ালাইজেশন
        reply, success, total_tokens = "System busy.", False, 0
        ai_data = {'success': False, 'total_tokens': 0}
        query_vector = None
        query_vector_type = 'text'
        # Defensive init for optional image/RAG context. These values are
        # populated only for media/knowledge branches but are consumed by
        # the common reply path as well.
        image_delivered = False
        image_caption = None
        product_image_context = ""

        post_context = ""
        if request_type == 'facebook_comment':
            post_context = get_smart_post_context(data.get('post_id'), effective_access_token)

        # ========================================================
        # ৭. ক্যাশ চেক — 7-Layer Grouped Lookup
        #
        #   NOTE: For media/image messages we bypass fuzzy caching because
        #   system-injected notes (e.g. "(System Note: The user uploaded an image...)")
        #   pollute the text and cause high false-positive fuzzy matches.
        # ========================================================

        # Prepare a clean user message for cache key generation (strip injected system notes)
        user_real_message = (text or '').split('(System Note:')[0].strip()

        # Detect media messages; if present, bypass fuzzy/exact cache to force fresh RAG
        is_media_message = bool(media_url) or (str(message_type or '').lower().startswith('image'))
        product_cache_bypass, product_cache_reason = _product_cache_policy(
            agent_config, user_real_message
        )

        cached_res = None
        cache_hit_scope = None  # কোন layer থেকে hit এলো সেটা track করার জন্য

        # Pre-LLM Cache Guardrail: Pure State & Context Driven
        user_order_state = _get_order_state(user_memory)
        collected_order_slots = _get_collected_order_fields(user_memory)
        has_active_order_state = user_order_state in ('collecting_details', 'awaiting_confirmation', 'editing') or bool(collected_order_slots)

        if is_media_message:
            logger.info(f"🖼️ Media message detected for sender {sender_id}; bypassing fuzzy/global cache checks.")
        elif is_audio:
            logger.info(f"🎙️ Audio/voice transcribed message detected for sender {sender_id}; bypassing cache checks for dynamic conversational handling.")
        elif has_active_order_state:
            logger.info(
                "🛒 Active order state detected (state=%s, collected=%s); bypassing generic cache checks for sender=%s.",
                user_order_state,
                list(collected_order_slots.keys()) if collected_order_slots else [],
                sender_id,
            )
        elif product_cache_bypass:
            logger.info(
                "🛡️ Product cache guardrail: bypassing generic reply cache "
                "sender=%s reason=%s message=%s",
                hashlib.sha256(str(sender_id).encode()).hexdigest()[:12],
                product_cache_reason,
                user_real_message[:80],
            )
        elif not is_system_redis_cache_enabled():
            logger.info("🚫 System-wide Redis response caching is disabled; bypassing cache checks.")
        elif agent_config and not agent_config.get_settings.redis_cache_enabled:
            logger.info(f"🚫 Redis message caching is disabled for agent {page_id}; bypassing cache checks.")
        else:
            # --- Layer 1: Agent Exact ---
            cached_res = get_cached_reply(page_id, msg_text=user_real_message)
            if cached_res:
                cache_hit_scope = "agent_exact"
        
            # --- Layer 1.5: Shared Agent Exact ---
            if not cached_res:
                shared_agents = agent_config.get_settings.shared_cache_agents.all()
                for shared_agent in shared_agents:
                    # Correct identifier logic for shared agents (Web Widget support)
                    shared_redis_id = f"widget_{shared_agent.widget_key}" if shared_agent.platform == 'web_widget' and shared_agent.widget_key else shared_agent.page_id
                    
                    potential_res = get_cached_reply(shared_redis_id, msg_text=user_real_message, track_hit=False)
                    if potential_res:
                        msg_hash = potential_res.get('msg_hash')
                        if not msg_hash:
                            # Fallback for old cache entries
                            normalized = normalize_for_cache(user_real_message)
                            msg_hash = hashlib.md5(normalized.encode()).hexdigest()

                        # এক্সক্লুশন চেক (Redis Set)
                        exclusion_key = f"agent:{shared_redis_id}:sharing_exclusion_set"
                        r_db4 = get_redis_client(db=4)
                        if not r_db4.sismember(exclusion_key, msg_hash):
                            cached_res = potential_res
                            cache_hit_scope = "shared_agent_exact"
                            # Track this hit for the current agent's ranking
                            incr_message_frequency(page_id, msg_hash)
                            logger.info(f"🔗 SHARED CACHE HIT (Exact) from Agent {shared_agent.name} for '{user_real_message[:30]}'")
                            break

            # --- Layer 2: Agent Fuzzy ---
            if not cached_res:
                cached_res = fuzzy_match(page_id, user_real_message, threshold=80)
                if cached_res:
                    cache_hit_scope = "agent_fuzzy"
            
            # --- Layer 2.5: Shared Agent Fuzzy ---
            if not cached_res:
                shared_agents = agent_config.get_settings.shared_cache_agents.all()
                for shared_agent in shared_agents:
                    shared_redis_id = f"widget_{shared_agent.widget_key}" if shared_agent.platform == 'web_widget' and shared_agent.widget_key else shared_agent.page_id
                    
                    potential_res = fuzzy_match(shared_redis_id, user_real_message, threshold=80, track_hit=False)
                    if potential_res:
                        msg_hash = potential_res.get('msg_hash')
                        if not msg_hash:
                            stored_text = potential_res.get('original_normalized') or user_real_message
                            msg_hash = hashlib.md5(stored_text.encode()).hexdigest()

                        # এক্সক্লুশন চেক
                        exclusion_key = f"agent:{shared_redis_id}:sharing_exclusion_set"
                        r_db4 = get_redis_client(db=4)
                        if not r_db4.sismember(exclusion_key, msg_hash):
                            cached_res = potential_res
                            cache_hit_scope = "shared_agent_fuzzy"
                            # Track this hit for the current agent too
                            incr_message_frequency(page_id, msg_hash)
                            logger.info(f"🔗 SHARED CACHE HIT (Fuzzy) from Agent {shared_agent.name} for '{user_real_message[:20]}'")
                            break

            # --- Layer 3: Global Exact ---
            if not cached_res:
                cached_res = get_global_cached_reply(page_id, user_real_message)
                if cached_res:
                    cache_hit_scope = "global_exact"

            # --- Layer 4: Global Fuzzy ---
            if not cached_res:
                cached_res = global_fuzzy_match(page_id, user_real_message, threshold=92)
                if cached_res:
                    cache_hit_scope = "global_fuzzy"

            # --- Layer 5: Sender Exact ---
            if not cached_res:
                cached_res = get_sender_cached_reply(page_id, sender_id, user_real_message)
                if cached_res:
                    cache_hit_scope = "sender_exact"

            # --- Layer 6: Cluster Match ---
            if not cached_res:
                cluster_map = get_cluster_map(page_id)
                normalized = normalize_for_cache(user_real_message)
                msg_hash = hashlib.md5(normalized.encode()).hexdigest()
                cluster_id = cluster_map.get(msg_hash)
                if cluster_id:
                    cached_res = get_cached_reply(page_id, msg_hash=cluster_id)
                    if cached_res:
                        cache_hit_scope = "cluster"
                        logger.info(f"🧬 CLUSTER MATCH FOUND for '{user_real_message[:30]}' -> Cluster: {cluster_id}")

        # --- Layer 7: Vector Similarity (Text + Image Embedding) ---
        if not cached_res:
            from aiAgent.models import SmartKeyword
            from embedding.models import SpreadsheetKnowledge
            from pgvector.django import CosineDistance

            has_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user).exists()
            skip_margin = 6
            skip_embedding = False
            text_len = len(text)
            image_caption = None
            
            db_skip_keywords = SmartKeyword.objects.filter(category='embedding_skip').values_list('text', flat=True)
            for kw in db_skip_keywords:
                if kw.lower() in text.lower() and abs(text_len - len(kw)) <= skip_margin:
                    skip_embedding = True
                    break

            if has_knowledge and not skip_embedding:
                from embedding.utils import get_gemini_embedding, get_gemini_image_embedding, get_image_caption
                
                # ১. TEXT EMBEDDING SEARCH
                text_vector = None
                text_hit = None
                media_message_placeholder = False
                message_type = str(data.get('message_type') or data.get('media_type') or '').lower()
                if message_type in ['image', 'video', 'audio', 'document'] and text and text.strip().lower().startswith('['):
                    media_message_placeholder = True

                if len(text) > 3 and not media_message_placeholder:
                    rag_query = f"{post_context} {text}" if (request_type == 'facebook_comment' and post_context) else text
                    text_vector = get_gemini_embedding(rag_query)
                    if text_vector:
                        vector_hits = search_similar_vectors(page_id, text_vector, top_k=1)
                        if vector_hits and vector_hits[0]['score'] < 0.12:
                            text_hit = vector_hits[0]
                            logger.info(f"🔤 Text vector match: '{text_hit['text'][:30]}' (score: {text_hit['score']:.4f})")
                
                # ২. IMAGE EMBEDDING SEARCH
                image_url = None
                image_vector = None
                image_caption = None
                image_hit = None
                product_image_context = ""
                product_image_match = None
                best_vector_type = None
                
                logger.info(f"[DEBUG] media_url in vector search scope: {media_url[:60] if media_url else 'NONE'}")
                logger.info(f"[DEBUG] base64 fields: image_base64={bool(data.get('image_base64'))}, video_base64={bool(data.get('video_base64'))}")
                
                # Extract image from incoming message across platforms
                if request_type == 'whatsapp':
                    # WhatsApp media: mediaUrl, media_url, or converted base64 data URL
                    # Priority 1: Use media_url if it's a data URL (created from base64 earlier)
                    if media_url and media_url.startswith('data:'):
                        image_url = media_url
                        logger.info(f"✅ [WhatsApp] Using converted base64 data URL for image embedding")
                    else:
                        # Priority 2: Direct mediaUrl/media_url
                        image_url = data.get('mediaUrl') or data.get('media_url')
                        logger.info(f"[WhatsApp] image_url from data: {image_url[:50] if image_url else 'None'}")
                elif request_type in ['messenger', 'facebook_comment', 'instagram']:
                    # Facebook/Messenger/Instagram: attachments array
                    attachments = data.get('attachments') or []
                    if isinstance(attachments, list) and len(attachments) > 0:
                        for attach in attachments:
                            if attach.get('type') in ['image', 'photo']:
                                image_url = attach.get('url') or attach.get('media', {}).get('image', {}).get('src')
                                if image_url:
                                    break
                elif request_type == 'telegram':
                    # Telegram: photo or document with image
                    if data.get('photo'):
                        photo_id = data['photo'][-1].get('file_id')  # Get highest res
                        if photo_id:
                            try:
                                api_url = f"https://api.telegram.org/bot{token}/getFile?file_id={photo_id}"
                                resp = requests.get(api_url, timeout=5).json()
                                file_path = resp.get('result', {}).get('file_path')
                                if file_path:
                                    image_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
                            except Exception as e:
                                logger.warning(f"Telegram photo URL fetch failed: {e}")
                
                # FALLBACK: If still no image_url, check for base64 and convert
                if not image_url:
                    media_base64_fallback = (
                        data.get('image_base64') or 
                        data.get('video_base64') or 
                        data.get('audio_base64') or 
                        data.get('document_base64')
                    )
                    if media_base64_fallback:
                        mime_type = data.get('mimetype') or 'application/octet-stream'
                        image_url = f'data:{mime_type};base64,{media_base64_fallback}'
                        logger.info(f"✅ [DEBUG] FALLBACK: Created data URL from {mime_type}. Size: {len(media_base64_fallback)} chars")
                
                # Generate image embedding and search if image found
                if image_url:
                    try:
                        from settings.models import GlobalSettings
                        logger.info(f"🖼️  [Image Processing] Starting. Image URL length: {len(image_url)}, starts with: {image_url[:50]}")
                        
                        image_vector = get_gemini_image_embedding(image_url)
                        logger.info(f"✅ [Image Embedding] Generated. Vector dims: {len(image_vector) if image_vector else 'None'}")
                        
                        global_settings = GlobalSettings.get_settings()
                        selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
                        logger.info(f"📝 [Caption Provider] Selected: {selected_provider}")
                        
                        image_caption = get_image_caption(image_url, provider=selected_provider)
                        logger.info(f"📸 [Image Caption] Generated: {image_caption[:80] if image_caption else 'None'}")
                        
                        if image_vector:
                            try:
                                from datasheet.product_search import build_product_image_context
                                caption_vector = get_gemini_embedding(image_caption) if image_caption else None
                                product_image_context, product_image_match = build_product_image_context(
                                    agent_config.user,
                                    image_vector,
                                    message=text,
                                    agent=agent_config,
                                    sender_id=sender_id,
                                    caption_vector=caption_vector,
                                )
                                if product_image_match:
                                    user_memory = _get_or_create_user_memory(agent_config, sender_id)
                                    memory_data = user_memory.data or {}
                                    memory_internal = memory_data.get("_internal", {})
                                    memory_internal["last_product_image_context"] = {
                                        "product_id": product_image_match["product_id"],
                                        "product_name": product_image_match["product_name"],
                                        "image_id": product_image_match["image_id"],
                                        "variant_id": product_image_match.get("variant_id"),
                                        "variant_attributes": product_image_match.get("variant_attributes") or {},
                                        "confidence": product_image_match["confidence"],
                                        "caption": product_image_match.get("image_caption") or "",
                                        "matched_at": timezone.now().isoformat(),
                                    }
                                    memory_data["_internal"] = memory_internal
                                    user_memory.data = memory_data
                                    user_memory.save(update_fields=["data"])
                                    logger.info(
                                        "product_image_context_saved sender_hash=%s product_id=%s variant_id=%s image_id=%s confidence=%s",
                                        hashlib.sha256(str(sender_id).encode()).hexdigest()[:12],
                                        product_image_match["product_id"],
                                        product_image_match.get("variant_id"),
                                        product_image_match["image_id"],
                                        product_image_match["confidence"],
                                    )
                            except Exception as product_image_err:
                                logger.warning(
                                    "product_image_context_failed error=%s",
                                    type(product_image_err).__name__,
                                )

                        if 'user_msg_obj' in locals() and user_msg_obj and image_caption:
                            orig_text = user_msg_obj.content or ""
                            if orig_text and orig_text not in ('[Image received]', '[Image]'):
                                user_msg_obj.content = f"{orig_text} [Image: {image_caption}]"
                            else:
                                user_msg_obj.content = f"[Image: {image_caption}]"
                            user_msg_obj.save(update_fields=['content'])
                            logger.info(f"💾 Saved updated user message content with visual description: {user_msg_obj.content[:100]}")
                            
                            try:
                                user_memory = _get_or_create_user_memory(agent_config, sender_id)
                                data = user_memory.data or {}
                                internal = data.get('_internal', {})
                                internal['last_image_caption'] = image_caption
                                data['_internal'] = internal
                                user_memory.data = data
                                user_memory.save(update_fields=['data'])
                                logger.info(f"🧠 [Memory Sync] Saved last_image_caption: '{image_caption[:80]}'")
                            except Exception as mem_err:
                                logger.error(f"Failed to save last_image_caption to memory: {mem_err}")
                        
                        if image_vector:
                            # Search image_embedding field in DB
                            image_matches = SpreadsheetKnowledge.objects.filter(
                                user=agent_config.user,
                                image_embedding__isnull=False
                            ).annotate(
                                distance=CosineDistance('image_embedding', image_vector)
                            ).order_by('distance')[:1]
                            
                            if image_matches:
                                match_obj = image_matches[0]
                                if match_obj.distance < 0.25:  # Image similarity threshold (more lenient than text)
                                    image_hit = {
                                        'text': match_obj.content,
                                        'row_id': match_obj.row_id,
                                        'score': float(match_obj.distance)
                                    }
                                    logger.info(f"🖼️ Image vector match: Row {match_obj.row_id} (distance: {match_obj.distance:.4f})")
                    except Exception as e:
                        logger.warning(f"⚠️ Image embedding search failed: {e}")
                
                # ३. COMBINE TEXT + IMAGE RESULTS
                best_hit = None
                hit_source = None
                best_vector = None
                best_vector_type = None

                if text_hit and image_hit:
                    # Both text and image matched - choose better one
                    if text_hit['score'] < image_hit['score']:
                        best_hit = text_hit
                        hit_source = "text+image_text"
                        best_vector = text_vector
                        best_vector_type = 'text'
                    else:
                        best_hit = image_hit
                        hit_source = "text+image_image"
                        best_vector = image_vector
                        best_vector_type = 'image'
                    logger.info(f"📊 Both text and image matched. Selected {hit_source}")
                elif text_hit:
                    best_hit = text_hit
                    hit_source = "text_only"
                    best_vector = text_vector
                    best_vector_type = 'text'
                elif image_hit:
                    best_hit = image_hit
                    hit_source = "image_only"
                    best_vector = image_vector
                    best_vector_type = 'image'

                # Validate and use best hit
                if best_hit:
                    similar_text = best_hit['text']
                    
                    # 🧪 COMPREHENSIVE RAG VALIDATION
                    validation_passed = True
                    validation_reason = ""
                    
                    # Product validation against catalog
                    vector_product = _infer_catalog_product_from_text(agent_config.user, similar_text)
                    if vector_product:
                        product_in_catalog = _validate_product_in_catalog(agent_config.user, vector_product, quantity=1)
                        if not product_in_catalog:
                            validation_passed = False
                            validation_reason = f"Product '{vector_product}' not found in catalog"
                    
                    if validation_passed:
                        cached_res = get_cached_reply(page_id, msg_text=similar_text)
                        if cached_res:
                            cache_hit_scope = f"vector_{hit_source}"
                            product_info = f"(Product: {vector_product})" if vector_product else ""
                            logger.info(f"🔮 VECTOR CACHE HIT [{hit_source}]! Text: '{text[:20]}' → Product: {product_info}")
                            # Preserve the best vector for perform_rag_search
                            if best_vector:
                                query_vector = best_vector
                                query_vector_type = best_vector_type or 'text'
                                logger.info(f"✅ [RAG] Using {query_vector_type} vector for perform_rag_search (skipping text embedding)")
                    else:
                        logger.warning(f"⚠️ Vector search result failed validation: {validation_reason}. Skipping vector hit.")
                
                # 🔥 CRITICAL FIX: If image vector exists but no vector-cache hit, still use image vector for RAG search
                if not cached_res and not query_vector and image_vector:
                    query_vector = image_vector
                    query_vector_type = 'image'
                    logger.info(f"✅ [RAG] Using image vector for perform_rag_search even without a direct image cache hit")

            else:
                logger.info(f"⏭️ Skipping Vector Embedding for User {agent_config.user.email} (No knowledge or skip kw)")


        # ৮. Cache Hit হলে → সরাসরি reply পাঠাও
        # ========================================================
        if cached_res:
            reply = cached_res.get('reply')
            success = True
            total_tokens = 0
            logger.info(
                "⚡ [CACHE_HIT] trace_id=%s cache_type=%s model=%s reply='%s'",
                msg_trace_id, cached_res.get('cache_type', 'cached'), cached_res.get('model', 'cache'), (reply or '').replace('\n', ' ')[:100]
            )

            # Retrieve cached metadata fields
            cached_handoff = cached_res.get('human_handoff', False)
            cached_image_intent = cached_res.get('image_intent', False)
            cached_order_intent = cached_res.get('order_intent')
            cached_order_data = cached_res.get('order_data')
            cached_best_row_id = cached_res.get('best_row_id')

            # 1. Human Handoff Pipeline
            if cached_handoff:
                reply = "অনুগ্রহ করে একটু অপেক্ষা করুন। আমাদের একজন human agent শীঘ্রই আপনার সাথে যোগাযোগ করবেন। 🙏"
                try:
                    platform_for_lookup = request_type if request_type in ['whatsapp', 'messenger', 'web_widget', 'facebook_comment', 'instagram'] else 'messenger'
                    updated = Contact.objects.filter(agent=agent_config, identifier=sender_id).update(is_human_needed=True)
                    logger.info(f"🔄 [Task - Cache Hit] Handoff update for {sender_id}: {'Success' if updated else f'FAILED'}")
                    if not updated:
                        Contact.objects.filter(agent=agent_config, identifier=sender_id).update(is_human_needed=True)
                    
                    contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id, platform=platform_for_lookup).first() or Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
                    if contact_obj:
                        contact_name = contact_obj.name or contact_obj.push_name or sender_id
                        send_human_handoff_ws(agent_config.user.id, page_id, sender_id, contact_obj.id, contact_name)
                        send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id)
                        logger.info(f"🚨 Human Handoff WS sent via Cache Hit for {sender_id}")
                except Exception as handoff_err:
                    logger.error(f"[Cache Hit] Error handling human handoff: {handoff_err}", exc_info=True)

            # 2. Order Creation Pipeline
            if cached_order_intent == 'create':
                if not isinstance(cached_order_data, dict):
                    cached_order_data = {}
                logger.info("[Cache Hit] Order intent detected! Processing order in DB...")
                try:
                    user_memory = _get_or_create_user_memory(agent_config, sender_id)
                    normalized_order, field_metadata = normalize_order_entities(agent_config.user, cached_order_data)
                    normalized_order = _seed_order_data_from_recent_interest(user_memory, normalized_order)
                    normalized_order = _hydrate_order_from_catalog(agent_config.user, normalized_order)
                    _save_order_fields_to_memory(user_memory, normalized_order, source='ai_extraction', field_metadata=field_metadata)
                    
                    if _has_complete_order_fields(user_memory):
                        order_obj = create_customer_order_from_memory(agent_config, sender_id, request_type, msg_id=msg_id)
                        if order_obj:
                            reply = f"✅ আপনার অর্ডার #{order_obj.id} নিশ্চিত করা হয়েছে। ইনভয়েস শীঘ্রই পাঠানো হবে।"
                            _deliver_reply_with_buttons(request_type, data, reply, sender_id, page_id, effective_access_token, agent_config)
                            if msg_id:
                                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                                r.delete(f'processing_msg:{msg_id}')
                            return reply
                    else:
                        confirmation = _get_confirmation_prompt(user_memory)
                        if confirmation:
                            reply = confirmation
                except Exception as seed_err:
                    logger.error(f"[Cache Hit] Failed to seed AI order into memory: {seed_err}", exc_info=True)

            # 3. Image Delivery Pipeline
            image_delivered = False
            if cached_image_intent:
                image_delivered, image_route = _deliver_images_for_ai_response(
                    request_type,
                    data,
                    cached_res,
                    cached_best_row_id,
                    agent_config,
                    sender_id
                )
                if image_delivered:
                    logger.info(f'[Cache Hit] AI image delivery performed: {image_route}')

            incr_counter(page_id, "cache_hit")
            logger.info(f"⚡ CACHE HIT [{cache_hit_scope}] → '{text[:30]}'")
            send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id if 'contact_obj' in locals() else None)

            save_message(agent_config, sender_id, reply, 'assistant', tokens=0, platform=agent_config.platform)

            clean_reply = reply.strip()
            # Force platform-based routing: if agent is WhatsApp, send via WhatsApp delivery
            if agent_config.platform == 'whatsapp':
                request_type = 'whatsapp'

            if request_type == 'web_widget':
                if msg_id:
                    r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                    r.delete(f'processing_msg:{msg_id}')
                return clean_reply
            elif request_type == 'dashboard':
                delivered = deliver_dashboard_reply(agent_config.user.id, clean_reply, msg_id)
            else:
                if image_delivered:
                    delivered = True
                else:
                    delivered = _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config)

            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')

            # ── Update WhatsApp Log (Cache Hit) ──
            if wa_msg_obj:
                wa_msg_obj.ai_reply = reply
                wa_msg_obj.save()

            total_elapsed_ms = int((time.time() - start_time) * 1000)
            logger.info(
                "🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s agent_id=%s delivered=%s total_time_ms=%s tokens=0 (cache_hit) reply='%s'",
                msg_trace_id, request_type, sender_id, getattr(agent_config, 'id', None), bool(delivered), total_elapsed_ms, clean_reply.replace('\n', ' ')[:100]
            )
            return  # 🔥 HARD STOP — AI call skip

        # ========================================================
        # ৯. Cache Miss → AI call + Grouped Cache Save
        # ========================================================
        else:
            incr_counter(page_id, 'cache_miss')
            logger.info("🔍 [CACHE_MISS] trace_id=%s proceeding to RAG / product pipeline", msg_trace_id)

            effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

            if not check_token_availability(user_profile, effective_model):
                total_elapsed_ms = int((time.time() - start_time) * 1000)
                logger.info(f">>> User {user_profile.user.email} has no tokens for model {effective_model}. Aborting.")
                logger.info(
                    "🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s agent_id=%s skipped_reason=token_limit_reached total_time_ms=%s",
                    msg_trace_id, request_type, sender_id, getattr(agent_config, 'id', None), total_elapsed_ms
                )
                if request_type == 'web_widget': return "Sorry, token limit reached for this agent."
                return

            order_instr = get_order_instructions(agent_config.user)
            resume_prompt = _get_interruption_resume_prompt(user_memory)
            if resume_prompt:
                order_instr = f"{order_instr or ''}\n\n{resume_prompt}"
            sheet_ctx, extra_instr, query_vector, best_hit_row_id = perform_rag_search(
                agent_config,
                text,
                post_context,
                order_instr,
                existing_vector=query_vector,
                vector_type=query_vector_type,
                image_caption=image_caption,
                sender_id=sender_id,
            )
            if product_image_context:
                sheet_ctx = (sheet_ctx or "") + product_image_context

            # Auto-sync recent_order_interest from RAG context
            if best_hit_row_id:
                inferred_prod = _infer_catalog_product_from_text(agent_config.user, sheet_ctx)
                if inferred_prod:
                    user_memory = _get_or_create_user_memory(agent_config, sender_id)
                    hydrated = _hydrate_order_from_catalog(agent_config.user, {'product_name': inferred_prod})
                    _save_recent_order_interest(
                        user_memory,
                        product_name=hydrated.get('product_name') or inferred_prod,
                        price=hydrated.get('price'),
                        source_text=text or image_caption
                    )
                    logger.info(f"🧠 [Backend RAG Auto-Sync] Saved recent_order_interest to '{inferred_prod}' from RAG best hit.")

            system_instruction, history, current_msg = build_ai_context(
                agent_config, sender_id, text, extra_instr, sheet_ctx,
                platform=request_type, message_type=message_type,
            )

            # ---- Cache Classification Instruction (JSON suffix) ----
            redis_cache_enabled = is_system_redis_cache_enabled() and (agent_config.get_settings.redis_cache_enabled if (agent_config and hasattr(agent_config, 'get_settings')) else False)
            settings_obj = agent_config.get_settings if (agent_config and hasattr(agent_config, 'get_settings')) else None
            should_include_image_prompt = has_image_support and is_image_msg
            
            # ---- Universal Response Classification & Schema DSL ----
            from aiAgent.prompts.classification_dsl import build_classification_dsl
            classify_instruction = "\n\n" + build_classification_dsl(
                redis_cache_enabled=redis_cache_enabled,
                settings_obj=settings_obj,
                has_image_support=has_image_support,
                is_image_msg=is_image_msg,
            )
            # This is the live response-classification prompt suffix. It remains
            # unchanged unless a compatible extension explicitly overrides it.
            try:
                from ai_extensions.resolver import apply_text_override
                classify_instruction, _ = apply_text_override(
                    "response-classification-instruction",
                    classify_instruction,
                    agent=agent_config,
                    user=getattr(agent_config, "user", None),
                    context={
                        "redis_cache_enabled": redis_cache_enabled,
                        "image_prompt_enabled": should_include_image_prompt,
                        "format_schema": classify_instruction,
                    },
                )
            except Exception:
                logger.exception("Classification prompt extension failed; using base instruction")
            system_instruction = system_instruction + classify_instruction
            product_context_attached = '[PRODUCT SEARCH RESULT - DATABASE AUTHORITATIVE]' in system_instruction
            logger.info(
                "🤖 [LLM_REQUEST] trace_id=%s model=%s context_chars=%s history_turns=%s product_context_attached=%s user_message='%s'",
                msg_trace_id, effective_model, len(system_instruction), len(history or []), product_context_attached, user_real_message.replace('\n', ' ')[:100]
            )
            ai_data = get_ai_response(agent_config, system_instruction, history, current_msg)
            logger.info(
                "📥 [LLM_RESPONSE] trace_id=%s success=%s total_tokens=%s raw_reply_chars=%s latency_ms=%s",
                msg_trace_id,
                bool(isinstance(ai_data, dict) and ai_data.get('success')),
                ai_data.get('total_tokens', 0) if isinstance(ai_data, dict) else 0,
                len(str(ai_data.get('reply', '') if isinstance(ai_data, dict) else '')),
                int((time.time() - start_time) * 1000)
            )

            # Ingest executed native tool results from live AI turn
            live_tool_data = ai_data.get('tool_execution_data') if isinstance(ai_data, dict) else None
            if live_tool_data and isinstance(live_tool_data, dict):
                logger.info("📦 [AI Live Tool Return Ingested]: status=%s loc_ids=%s", live_tool_data.get('status'), live_tool_data.get('location_ids'))
                loc_ids = live_tool_data.get('location_ids') or {}
                matched_names = live_tool_data.get('matched_names') or {}
                user_memory = _get_or_create_user_memory(agent_config, sender_id)
                mem_d = user_memory.data or {}
                if any(loc_ids.values()):
                    mem_d.setdefault('_internal', {})['courier_location_ids'] = {live_tool_data.get('provider'): loc_ids}
                if any(matched_names.values()):
                    mem_d.setdefault('_internal', {})['courier_matched_names'] = matched_names
                if live_tool_data.get('status') == 'needs_clarification' and live_tool_data.get('suggested_areas'):
                    mem_d.setdefault('_internal', {})['pending_courier_area_suggestions'] = live_tool_data.get('suggested_areas')
                    _set_order_state(user_memory, 'collecting_details')
                elif live_tool_data.get('status') == 'valid':
                    mem_d.setdefault('_internal', {}).pop('pending_courier_area_suggestions', None)
                    if _has_complete_order_fields(user_memory):
                        _set_order_state(user_memory, 'awaiting_confirmation')
                user_memory.data = mem_d
                user_memory.save(update_fields=['data'])

            # ---- Parse JSON from AI reply (Using clean_ai_response to fix broken JSON & type mismatches) ----
            raw_ai_reply = ai_data.get('reply', '')
            cache_type = 'agent_specific' if redis_cache_enabled else 'no_cache'
            parsed_reply = raw_ai_reply    #  ডিফাল্ট: raw reply
            json_parse_success = False
            is_handoff = False
            is_json_handoff_override = False

            # 💥 Apply defensive JSON cleaning (extracts JSON from mixed text + fixes 'got int' errors)
            cleaned_data = clean_ai_response(raw_ai_reply)
            parsed = cleaned_data
            
            try:
                extracted_reply = parsed.get('reply', '').strip()
                if extracted_reply:  # শুধু non-empty reply গ্রহণ করা হবে
                    parsed_reply = extracted_reply
                    cache_type = parsed.get('cache_type', 'agent_specific').strip().lower()
                    json_parse_success = True

                    # Remove any hallucinated markdown images like ![...](...) from parsed_reply
                    import re
                    has_markdown_image = False
                    if parsed_reply and isinstance(parsed_reply, str):
                        has_markdown_image = bool(re.search(r'!\[.*?\]\(.*?\)', parsed_reply))
                        if has_markdown_image:
                            parsed_reply = re.sub(r'!\[.*?\]\(.*?\)', '', parsed_reply).strip()

                    # Rely on AI's image_intent classification (or markdown image emission)
                    if (has_markdown_image or parsed.get('image_intent')) and has_image_support:
                        parsed['image_intent'] = True
                        logger.info("🖼️ [Image Delivery] AI image_intent=True (has_markdown_img=%s)", has_markdown_image)

                    # --- Human Handoff Check ---
                    if parsed.get('human_handoff') is True or str(parsed.get('human_handoff')).lower() == 'true':
                        is_handoff = True
                        is_json_handoff_override = True

                    logger.info(f"📋 AI cache_type classified as: '{cache_type}' for '{text[:30]}'")
                    logger.info(
                        "✨ [RESPONSE_PARSED] trace_id=%s order_intent=%s image_intent=%s cache_type=%s reply='%s'",
                        msg_trace_id, parsed.get('order_intent'), parsed.get('image_intent'), cache_type, parsed_reply.replace('\n', ' ')[:100]
                    )
                    logger.info(f"AI Response JSON: {parsed}")
                    
                    order_intent = parsed.get('order_intent') or None
                    order_data = parsed.get('order_data') or {}

                    # NEW: Resolve numbered or textual selection from pending_courier_area_suggestions
                    user_memory = _get_or_create_user_memory(agent_config, sender_id)
                    internal = user_memory.data.get('_internal', {})
                    pending_areas = internal.get('pending_courier_area_suggestions') or []
                    user_text_clean = str(text or "").strip()
                    
                    matched_sugg = None
                    if pending_areas and user_text_clean:
                        # Convert Bengali digits to English
                        bn_to_en = {'১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'}
                        norm_input = "".join(bn_to_en.get(c, c) for c in user_text_clean).strip()
                        if norm_input.isdigit():
                            sel_idx = int(norm_input)
                            for s in pending_areas:
                                if s.get('index') == sel_idx:
                                    matched_sugg = s
                                    break
                        if not matched_sugg:
                            # Match by name
                            for s in pending_areas:
                                s_name = str(s.get('name') or '').strip().lower()
                                if s_name and (s_name in user_text_clean.lower() or user_text_clean.lower() in s_name):
                                    matched_sugg = s
                                    break

                    if matched_sugg:
                        logger.info("🎯 Customer resolved courier area from suggestions: %s", matched_sugg)
                        sel_name = matched_sugg.get('name')
                        sel_city = matched_sugg.get('city_id')
                        sel_zone = matched_sugg.get('zone_id')
                        sel_area = matched_sugg.get('area_id')
                        active_prov = 'pathao' if sel_zone else 'steadfast'

                        # Lock IDs directly
                        mem_d = user_memory.data or {}
                        mem_d.setdefault('_internal', {})['courier_location_ids'] = {
                            active_prov: {"city_id": sel_city, "zone_id": sel_zone, "area_id": sel_area}
                        }
                        # Clear pending suggestions
                        mem_d['_internal'].pop('pending_courier_area_suggestions', None)

                        # Step 1: Preserve full_address 100% intact, append [Courier Hub: <name>] if not present
                        curr_fields = mem_d['_internal'].get('order_fields', {})
                        addr_field = curr_fields.get('address', {})
                        raw_addr = str(addr_field.get('value') or '').strip()
                        if raw_addr and sel_name and sel_name.lower() not in raw_addr.lower():
                            raw_addr = f"{raw_addr} [Courier Hub: {sel_name}]"
                        if raw_addr:
                            addr_field['value'] = raw_addr
                            curr_fields['address'] = addr_field
                            mem_d['_internal']['order_fields'] = curr_fields

                        user_memory.data = mem_d
                        user_memory.save(update_fields=['data'])

                        # Ensure order intent is create so it proceeds to complete verification
                        if not order_intent:
                            order_intent = 'create'

                    if order_intent in ['create', 'confirm']:
                        user_memory = _get_or_create_user_memory(agent_config, sender_id)
                        internal = user_memory.data.get('_internal', {})
                        if 'last_image_caption' in internal:
                            internal.pop('last_image_caption', None)
                            user_memory.data['_internal'] = internal
                            user_memory.save(update_fields=['data'])
                            logger.info("🗑️ Cleared last_image_caption from memory due to active order intent.")

                    # Sync recent_order_interest memory from AI's output product_name
                    if isinstance(order_data, dict):
                        ai_product = order_data.get('product_name')
                        if ai_product:
                            user_memory = _get_or_create_user_memory(agent_config, sender_id)
                            hydrated = _hydrate_order_from_catalog(agent_config.user, {'product_name': ai_product})
                            _save_recent_order_interest(
                                user_memory,
                                product_name=hydrated.get('product_name') or ai_product,
                                price=hydrated.get('price'),
                                source_text=text or image_caption
                            )
                            logger.info(f"🧠 [AI-Driven Memory Sync] Saved recent_order_interest to '{ai_product}' from AI order_data.")
                        
                        # Persist extra_info (color/variant choice) even when browsing (order_intent: null)
                        extra_info_val = order_data.get('extra_info')
                        if extra_info_val:
                            user_memory = _get_or_create_user_memory(agent_config, sender_id)
                            _save_order_fields_to_memory(
                                user_memory,
                                {'extra_info': str(extra_info_val).strip()},
                                source='ai_extraction'
                            )
                            logger.info("🎨 [AI-Driven Memory Sync] Saved extra_info='%s' from AI order_data.", extra_info_val)

                    # Real-time In-Chat AI Memory Sync (Zero extra LLM cost: AI decides permanent vs temporary)
                    extracted_mem = parsed.get('extracted_memory')
                    if isinstance(extracted_mem, dict) and extracted_mem:
                        try:
                            user_memory = _get_or_create_user_memory(agent_config, sender_id)
                            curr_data = user_memory.data or {}
                            updated_keys = []
                            bn_to_en = str.maketrans('০১২৩৪৫৬৭৮৯', '0123456789')
                            for k, v in extracted_mem.items():
                                if str(k).startswith('_'):
                                    continue
                                if isinstance(v, str) and v.strip() == "":
                                    # AI explicitly cleared an invalid/corrupted permanent memory field
                                    curr_data.pop(k, None)
                                    updated_keys.append(f"-{k}")
                                elif v is not None:
                                    val_clean = str(v).strip() if isinstance(v, str) else v
                                    if k in ('phone_number', 'phone') and isinstance(val_clean, str):
                                        val_clean = val_clean.translate(bn_to_en)
                                    curr_data[k] = val_clean
                                    updated_keys.append(k)
                            if updated_keys:
                                user_memory.data = curr_data
                                user_memory.save(update_fields=['data'])
                                logger.info("🧠 [Live AI Memory Ingestion] Updated UserMemory for %s with keys: %s", sender_id, updated_keys)
                        except Exception as mem_sync_err:
                            logger.warning("Failed to sync live AI extracted memory: %s", mem_sync_err)

                    # If AI provided an order_intent, seed memory and optionally auto-confirm
                    current_state = _get_order_state(user_memory)
                    if order_intent in ['create', 'confirm']:
                        logger.info(
                            "📦 [ORDER_SYNC] trace_id=%s intent=%s state=%s order_data=%s",
                            msg_trace_id, order_intent, current_state, json.dumps(order_data, ensure_ascii=False, default=str)
                        )
                    if order_intent == 'confirm':
                        # Pure State & AI-Intent Driven Order Finalization Guard
                        # 1. If live courier check ran this turn, downgrade to create
                        if live_tool_data and isinstance(live_tool_data, dict):
                            logger.info("📦 Courier validation executed this turn; downgrading order_intent from 'confirm' to 'create'.")
                            order_intent = 'create'
                        else:
                            is_modification = False
                            prev_fields = _get_order_fields(user_memory) if user_memory else {}
                            
                            if isinstance(order_data, dict):
                                for f in ('customer_name', 'phone_number', 'address', 'upazila', 'district', 'quantity'):
                                    new_v = order_data.get(f)
                                    old_v = prev_fields.get(f, {}).get('value')
                                    if new_v and str(new_v).strip() != str(old_v or "").strip():
                                        is_modification = True
                                        logger.info(f"🔄 Order modification detected on '{f}' ({old_v} -> {new_v}). Showing updated draft instead of auto-confirm.")
                                        break

                            pending_suggs = (user_memory.data or {}).get('_internal', {}).get('pending_courier_area_suggestions') or []
                            has_all_fields = _has_complete_order_fields(user_memory)

                            # If complete fields and no pending courier selection, allow confirmation regardless of transient state label
                            can_confirm = (current_state == 'awaiting_confirmation' or has_all_fields) and not is_modification and not pending_suggs

                            if can_confirm:
                                logger.info("Order confirm intent detected! Creating order...")
                                try:
                                    order_obj = create_customer_order_from_memory(agent_config, sender_id, request_type, msg_id=msg_id)
                                    if order_obj:
                                        logger.info(
                                            "🎉 [ORDER_CREATED] trace_id=%s order_id=%s customer='%s' phone='%s' total_amount=%s",
                                            msg_trace_id, order_obj.id, getattr(order_obj, 'customer_name', ''), getattr(order_obj, 'phone_number', ''), getattr(order_obj, 'total_price', '')
                                        )
                                        parsed_reply = f"✅ আপনার অর্ডার #{order_obj.id} নিশ্চিত করা হয়েছে। ইনভয়েস শীঘ্রই পাঠানো হবে।"
                                        _clear_order_fields(user_memory)
                                        cache_type = 'no_cache'
                                    else:
                                        parsed_reply = "দুঃখিত, আপনার অর্ডার নিশ্চিত করা যায়নি। দয়া করে আবার চেষ্টা করুন।"
                                        cache_type = 'no_cache'
                                except Exception as order_create_err:
                                    logger.exception("🚨 Error during order creation: %s", order_create_err)
                                    parsed_reply = "দুঃখিত, অর্ডার সংরক্ষণে একটি কারিগরি সমস্যা হয়েছে। আমাদের প্রতিনিধি শীঘ্রই যোগাযোগ করবেন।"
                                    cache_type = 'no_cache'
                            else:
                                if is_modification:
                                    logger.info("Field modified during confirmation stage. Re-routing intent to 'create' to update draft.")
                                    order_intent = 'create'
                                else:
                                    logger.warning("AI sent confirm intent but pending courier clarification or incomplete slots. Redirecting to create.")
                                    order_intent = 'create'

                    if order_intent == 'cancel':
                        logger.info("Order cancel intent detected! Clearing order...")
                        _clear_order_fields(user_memory)
                        if not parsed_reply or not parsed_reply.strip():
                            parsed_reply = "আপনার অর্ডারটি বাতিল করা হয়েছে। প্রয়োজনে আবার নতুন করে শুরু করতে পারেন।"
                        cache_type = 'no_cache'
                    elif order_intent == 'interrupted':
                        logger.info("Order interruption intent detected! Suspending order flow...")
                        _set_interruption_buffer(user_memory, _get_next_missing_field(user_memory) or 'order')
                        _set_order_state(user_memory, 'idle')
                        cache_type = 'no_cache'
                    elif order_intent == 'create':
                        if not isinstance(order_data, dict):
                            order_data = {}
                        logger.info("Order intent detected! Processing order in DB...")
                        try:
                            # Seed parsed order fields into user memory (normalize + save)
                            user_memory = _get_or_create_user_memory(agent_config, sender_id)
                            normalized_order, field_metadata = normalize_order_entities(agent_config.user, order_data)
                            normalized_order = _seed_order_data_from_recent_interest(user_memory, normalized_order)
                            normalized_order = _hydrate_order_from_catalog(agent_config.user, normalized_order)
                            _save_order_fields_to_memory(user_memory, normalized_order, source='ai_extraction', field_metadata=field_metadata)

                            # Determine intent confidence (fallbacks)
                            intent_conf = None
                            if parsed.get('order_intent_confidence') is not None:
                                intent_conf = float(parsed.get('order_intent_confidence') or 0)
                            elif parsed.get('confidence') is not None:
                                try:
                                    intent_conf = float(parsed.get('confidence') or 0)
                                except Exception:
                                    intent_conf = None
                            if intent_conf is None:
                                intent_conf = 1.0

                            # If AI returned courier_check in JSON (and did not already run live_tool_data), execute tool with AI's arguments
                            ai_courier_call = parsed.get('courier_check')
                            if not live_tool_data and isinstance(ai_courier_call, dict) and (ai_courier_call.get('district') or ai_courier_call.get('upazila')):
                                try:
                                    from aiAgent.tools.courier_validation_tool import validate_and_suggest_courier_area
                                    call_dist = ai_courier_call.get('district')
                                    call_upz = ai_courier_call.get('upazila')
                                    call_addr = ai_courier_call.get('address') or order_data.get('address')
                                    call_hint = ai_courier_call.get('sub_area_hint')
                                    call_area_id = ai_courier_call.get('area_id')
                                    fail_cnt = (user_memory.data or {}).get('_internal', {}).get('failed_attempts', {}).get('address', {}).get('count', 0)
                                    logger.info("🤖 AI directly triggered courier_check tool: district=%s, upazila=%s, address=%s, hint=%s, area_id=%s", call_dist, call_upz, call_addr, call_hint, call_area_id)
                                    direct_res = validate_and_suggest_courier_area(
                                        merchant=agent_config.user,
                                        district=call_dist,
                                        upazila=call_upz,
                                        full_address=call_addr,
                                        sub_area_hint=call_hint,
                                        area_id=call_area_id,
                                        address_fail_count=fail_cnt
                                    )
                                    loc_ids = direct_res.get('location_ids') or {}
                                    matched_names = direct_res.get('matched_names') or {}
                                    mem_d = user_memory.data or {}
                                    if any(loc_ids.values()):
                                        mem_d.setdefault('_internal', {})['courier_location_ids'] = {direct_res.get('provider'): loc_ids}
                                    if any(matched_names.values()):
                                        mem_d.setdefault('_internal', {})['courier_matched_names'] = matched_names
                                    if direct_res.get('status') == 'needs_clarification' and direct_res.get('suggested_areas'):
                                        mem_d.setdefault('_internal', {})['pending_courier_area_suggestions'] = direct_res.get('suggested_areas')
                                        _set_order_state(user_memory, 'collecting_details')
                                    elif direct_res.get('status') == 'valid':
                                        mem_d.setdefault('_internal', {}).pop('pending_courier_area_suggestions', None)
                                    user_memory.data = mem_d
                                    user_memory.save(update_fields=['data'])
                                except Exception as direct_tool_err:
                                    logger.warning("Error running AI-triggered courier check: %s", direct_tool_err)

                            # Pure State & AI-Driven Transition: Never run a redundant backend courier check without sub_area_hint
                            # or append hardcoded alphabetical area lists onto AI's reply!
                            pending_suggs_now = (user_memory.data or {}).get('_internal', {}).get('pending_courier_area_suggestions') or []
                            if _has_complete_order_fields(user_memory) and not pending_suggs_now:
                                _set_order_state(user_memory, 'awaiting_confirmation')
                            else:
                                _set_order_state(user_memory, 'collecting_details')

                            # Keep CheckoutSession synced with latest in-chat order fields and locked courier_location_ids
                            try:
                                from aiAgent.business_logic.logic_handler import _get_checkout_url_for_contact
                                from aiAgent.models import Contact
                                contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first() if sender_id else None
                                checkout_url = _get_checkout_url_for_contact(contact) if contact else None
                                eff_platform = (request_type or (agent_config.platform if agent_config else 'whatsapp')).lower()
                                if eff_platform in ['whatsapp'] and checkout_url and checkout_url not in parsed_reply:
                                    if _has_complete_order_fields(user_memory):
                                        link_cta = (
                                            f"\n\n🛒 নিচের লিংকে ক্লিক করে শপ থেকে ১-ক্লিকে অর্ডার কনফার্ম করতে পারেন:\n👉 {checkout_url}"
                                        )
                                    else:
                                        link_cta = (
                                            f"\n\n🛒 নিচের লিংকে ক্লিক করে শপ থেকে ১-ক্লিকে অর্ডার কনফার্ম করতে পারেন:\n👉 {checkout_url}\n"
                                            "(অথবা আপনি চাইলে এখানে চ্যাটেও আপনার নাম, মোবাইল নম্বর এবং পূর্ণ ঠিকানা দিতে পারেন)"
                                        )
                                    parsed_reply = parsed_reply.rstrip() + link_cta
                                cache_type = 'no_cache'
                            except Exception as link_err:
                                logger.warning(f"Error syncing/appending 1-click checkout link on order intent: {link_err}")
                        except Exception as seed_err:
                            logger.error(f"Failed to seed AI order into memory: {seed_err}", exc_info=True)
                else:
                    logger.warning(f"⚠️ JSON parsed but reply field is empty. Using raw.")
            except (KeyError, TypeError, ValueError) as e:
                logger.warning(f"⚠️ Error processing cleaned AI response: {e}. Using raw reply.")

            if product_context_attached:
                logger.info("product_pipeline stage=ai_answer_processed page_id=%s json_parse_success=%s cache_type=%s handoff=%s reply_chars=%s", page_id, json_parse_success, cache_type, is_handoff, len(parsed_reply or ''))

            if product_cache_bypass and cache_type != "no_cache":
                logger.info(
                    "🛡️ Product cache guardrail: overriding AI cache_type=%s to no_cache "
                    "reason=%s",
                    cache_type,
                    product_cache_reason,
                )
                cache_type = "no_cache"

            if is_handoff:
                # Override reply with friendly handoff message if it was a JSON-detected handoff
                if is_json_handoff_override:
                    parsed_reply = "অনুগ্রহ করে একটু অপেক্ষা করুন। আমাদের একজন human agent শীঘ্রই আপনার সাথে যোগাযোগ করবেন। 🙏"
                
                # We no longer override cache_type to no_cache here because we want to cache the handoff intent.
                try:
                    platform_for_lookup = request_type if request_type in ['whatsapp', 'messenger', 'web_widget', 'facebook_comment', 'instagram'] else 'messenger'
                    
                    # Update is_human_needed (Robust lookup using only Agent + ID)
                    updated = Contact.objects.filter(
                        agent=agent_config,
                        identifier=sender_id
                    ).update(is_human_needed=True)
                    
                    logger.info(f"🔄 [Task] Handoff update for {sender_id}: {'Success' if updated else f'FAILED (Contact {sender_id} not found)'}")

                    if not updated:
                        updated_fallback = Contact.objects.filter(agent=agent_config, identifier=sender_id).update(is_human_needed=True)
                        logger.info(f"🔄 Handoff fallback update for {sender_id}: {'Success' if updated_fallback else 'Failed completely'}")

                    # Get contact for WS payload (platform specific)
                    contact_obj = Contact.objects.filter(
                        agent=agent_config, 
                        identifier=sender_id,
                        platform=platform_for_lookup
                    ).first() or Contact.objects.filter(agent=agent_config, identifier=sender_id).first()

                    if contact_obj:
                        contact_name = contact_obj.name or contact_obj.push_name or sender_id
                        send_human_handoff_ws(agent_config.user.id, page_id, sender_id, contact_obj.id, contact_name)
                        send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id) # Force sync
                        logger.info(f"🚨 Human Handoff WS sent for {sender_id} (Platform: {platform_for_lookup})")
                    else:
                        logger.warning(f"⚠️ Could not find Contact object to send WS for {sender_id}")
                except Exception as handoff_err:
                    logger.error(f"Error handling human handoff: {handoff_err}", exc_info=True)

            # 🛡️ Safety Guard: Broken/Truncated JSON Detection
            # যদি json_match না পাওয়া যায় AND raw reply দেখতে JSON-এর মতো হয়
            # (মানে AI শুরু করেছে কিন্তু token limit-এ কেটে গেছে)
            # → user-এর কাছে broken JSON text পাঠানো যাবে না
            if not json_parse_success:
                stripped = raw_ai_reply.strip()
                looks_like_broken_json = (
                    stripped.startswith('{') or
                    stripped.startswith('{"reply"') or
                    stripped.startswith('```json')
                )
                if looks_like_broken_json:
                    logger.error(
                        f"🚨 BROKEN/TRUNCATED JSON detected (output_tokens={ai_data.get('output_tokens',0)}). "
                        f"Raw: '{raw_ai_reply[:60]}'. Marking as failed — NOT sending to user."
                    )
                    ai_data['success'] = False
                    ai_data['reply'] = ''
                    parsed_reply = ''
                # else: plain text response (no JSON at all) → use as-is, normal fallback

            # 🛡️ Safety Clean: Strip raw markdown images and detect image request intent
            has_markdown_img = bool(re.search(r'!\[.*?\]\([^\)]*\)', parsed_reply or ''))
            if has_markdown_img:
                parsed_reply = re.sub(r'!\[.*?\]\([^\)]*\)', '', parsed_reply).strip()

            if not isinstance(parsed, dict):
                parsed = {'reply': parsed_reply}

            if has_markdown_img:
                parsed['image_intent'] = True
            elif not parsed.get('image_intent'):
                parsed['image_intent'] = False

            # Update ai_data with the cleaned reply. Provider/base failures must
            # never crash the task because an optional key is missing.
            if not isinstance(ai_data, dict):
                ai_data = {"reply": str(ai_data or "")}
            ai_data.setdefault('reply', '')
            ai_data.setdefault('total_tokens', 0)
            ai_data.setdefault('input_tokens', 0)
            ai_data.setdefault('output_tokens', 0)
            ai_data.setdefault('success', bool(ai_data.get('reply')))
            ai_data['reply'] = parsed_reply
            if isinstance(parsed, dict):
                parsed['reply'] = parsed_reply
            reply, success, total_tokens = ai_data['reply'], ai_data['success'], ai_data['total_tokens']


            if success:
                effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

                deduct_user_tokens(user_profile, total_tokens, effective_model, is_image_query=is_image_msg)

                # ---- Image delivery (AI-driven) ----
                image_delivered = False
                if parsed.get('image_intent'):
                    image_delivered, image_route = _deliver_images_for_ai_response(
                        request_type,
                        data,
                        parsed,
                        best_hit_row_id,
                        agent_config,
                        sender_id
                    )
                    if image_delivered:
                        logger.info(
                            "🖼️ [IMAGE_ROUTED] trace_id=%s platform=%s route=%s",
                            msg_trace_id, request_type, image_route
                        )
                        logger.info(f'AI image delivery performed: {image_route}')
                        try:
                            # Charge 500 extra tokens flat surcharge for image delivery
                            deduct_user_tokens(user_profile, 500, effective_model, is_image_query=True)
                            # Create a TokenUsageLog entry for the image delivery surcharge
                            from aiAgent.models import TokenUsageLog
                            TokenUsageLog.objects.create(
                                user=agent_config.user,
                                ai_agent=agent_config,
                                sender_id=sender_id,
                                model_name=effective_model,
                                input_tokens=0,
                                output_tokens=0,
                                total_tokens=500,
                                platform=request_type or "messenger",
                                request_type='image_delivery',
                                success=True
                            )
                        except Exception as charge_err:
                            logger.error(f"Failed to charge image delivery surcharge: {charge_err}")

                # ---- 3-Tier Grouped Cache Save & Vector Embedding (Pure State & AI-Intent Driven) ----
                post_order_data = parsed.get('order_data') or {}
                has_customer_slots = isinstance(post_order_data, dict) and any(
                    post_order_data.get(k) for k in ("customer_name", "phone_number", "address", "district", "upazila", "items")
                )
                skip_similarity_and_vector = (
                    cache_type in ("no_cache", "sender_specific")
                    or parsed.get('order_intent') is not None
                    or has_customer_slots
                    or is_handoff is True
                    or bool(parsed.get('image_intent'))
                )

                redis_cache_enabled = is_system_redis_cache_enabled() and (agent_config.get_settings.redis_cache_enabled if agent_config else False)
                if not redis_cache_enabled:
                    logger.info(f"🚫 Cache SKIPPED (redis_cache_enabled=False) for: '{text[:30]}'")
                elif skip_similarity_and_vector:
                    logger.info(
                        "🚫 Cache & Vector SKIPPED due to active order intent / PII / no_cache | cache_type=%s, order_intent=%s, has_slots=%s, handoff=%s",
                        cache_type, parsed.get('order_intent'), has_customer_slots, is_handoff
                    )
                elif cache_type == 'global':
                    set_global_cached_reply(
                        text, reply, model=effective_model,
                        input_tokens=ai_data.get('input_tokens', 0),
                        output_tokens=ai_data.get('output_tokens', 0),
                        cache_type=cache_type,
                        human_handoff=is_handoff,
                        image_intent=parsed.get('image_intent'),
                        image_style=parsed.get('image_style'),
                        order_intent=parsed.get('order_intent'),
                        order_data=parsed.get('order_data'),
                        best_row_id=best_hit_row_id
                    )
                    send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id if contact_obj else None)
                elif cache_type == 'agent_specific':
                    # বিদ্যমান agent-level cache (DB 2) - pure FAQ queries with no order state/PII
                    set_cached_reply(
                        page_id, text, reply, model=effective_model,
                        input_tokens=ai_data.get('input_tokens', 0),
                        output_tokens=ai_data.get('output_tokens', 0),
                        is_special=agent_config.is_special_agent,
                        cache_type=cache_type,
                        human_handoff=is_handoff,
                        image_intent=parsed.get('image_intent'),
                        image_style=parsed.get('image_style'),
                        order_intent=parsed.get('order_intent'),
                        order_data=parsed.get('order_data'),
                        best_row_id=best_hit_row_id
                    )
                    send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id, contact_id=contact_obj.id if contact_obj else None)
                else:
                    # অজানা type → save করা হবে না
                    logger.info(f"🚫 Cache SKIPPED (unsupported type: {cache_type}) for: '{text[:30]}'")

                # ---- Clustering & Vector Embedding Save ----
                # Never index vectors or clusters for transactional/order/PII/handoff messages
                if not skip_similarity_and_vector:
                    try:
                        from aiAgent.cache.cluster import assign_to_cluster
                        from aiAgent.cache.hybrid_similarity import find_best_cached_hash
                        best_cluster_hash = find_best_cached_hash(page_id, text, threshold=70)
                        target_hash = best_cluster_hash if best_cluster_hash else hashlib.md5(normalize_for_cache(text).encode()).hexdigest()
                        assign_to_cluster(page_id, text, target_hash)
                    except Exception as e:
                        logger.error(f"Failed to assign cluster: {e}")

                    if query_vector:
                        msg_hash_for_vector = hashlib.md5(normalize_for_cache(text).encode()).hexdigest()
                        save_vector_embedding(page_id, text, msg_hash_for_vector, query_vector)
                        logger.info(f"✅ Saved vector embedding for '{text[:30]}'")

                save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens, platform=agent_config.platform)

                # ── Update WhatsApp Log (AI Call) ──
                if wa_msg_obj:
                    wa_msg_obj.ai_reply = reply
                    wa_msg_obj.save()

            duration = int((time.time() - start_time) * 1000)
            log_token_usage(agent_config, sender_id, ai_data, duration, request_type)
            clean_reply = reply.strip()
            
            if request_type == 'web_widget':
                delivered = True
                if msg_id:
                    r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                    r.delete(f'processing_msg:{msg_id}')
                return clean_reply
            elif request_type == 'dashboard':
                delivered = deliver_dashboard_reply(agent_config.user.id, clean_reply, msg_id)
            else:
                if image_delivered:
                    delivered = True
                else:
                    delivered = _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config)

            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')

            total_elapsed_ms = int((time.time() - start_time) * 1000)
            logger.info(
                "🏁 [MSG_END] trace_id=%s platform=%s sender_id=%s agent_id=%s delivered=%s total_time_ms=%s tokens=%s reply='%s'",
                msg_trace_id, request_type, sender_id, getattr(agent_config, 'id', None), bool(delivered), total_elapsed_ms, total_tokens, clean_reply.replace('\n', ' ')[:100]
            )

    except Exception as e:
        logger.error(f"Task Error: {e}")

    finally:
        # Lock Release
        try:
            current_lock = r.get(lock_key)
            if current_lock and current_lock.decode() == lock_value:
                r.delete(lock_key)
                logger.info(f"🔓 Lock released for {sender_id}")

            if msg_id:
                r.delete(f'processing_msg:{msg_id}')
        except Exception as lock_err:
            logger.error(f"Lock release error: {lock_err}")
