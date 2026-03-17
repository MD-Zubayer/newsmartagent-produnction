# aiAgent/business_logic/logic_handler.py
from celery import shared_task
import requests

from aiAgent.models import AgentAI
from chat.services import save_message
from aiAgent.models import AgentAI, MissingRequirement, TokenUsageLog
from aiAgent.memory_service import extract_and_update_memory
from aiAgent.memory_handler import (
    handle_smart_memory_update, 
    get_keywords_by_category, 
    check_keyword_match
)
from webhooks.constants import TARGET_KEYWORDS
from aiAgent.data_processor import processor_spreadsheet_data
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import time
from embedding.models import SpreadsheetKnowledge, DocumentKnowledge
from pgvector.django import CosineDistance
from embedding.utils import get_gemini_embedding
from settings.models import AgentSettings
from users.models import OrderForm
import redis
import signal
import logging
import uuid
from django.db.models import F
from webhooks.utils import fetch_facebook_post_text, get_message_cache, set_message_cache
from chat.utils import get_smart_post_context
from aiAgent.cache.hybrid_similarity import get_cached_reply, set_cached_reply
from aiAgent.cache.ranking import incr_message_frequency
from aiAgent.cache.metrics import incr_counter
import hashlib
from aiAgent.cache.utils import normalize_text
from chat.services import get_last_message
from webhooks.comment import deliver_public_comment_reply
logger = logging.getLogger('aiAgent')

def get_order_instructions(user):
    order_instruction = ""
    try:
        settings, created = AgentSettings.objects.get_or_create(user=user)
        if settings.is_order_enable:
            try:
                order_form = OrderForm.objects.get(user=user)
                link = f'https://newsmartagent.com/orders/{order_form.form_id}'
                order_instruction = f"If user wants to buy/order, strictly give this link: {link}."
                return order_instruction
            except OrderForm.DoesNotExist:
                order_instruction = "If they want to buy, say order form is not ready yet."
                return order_instruction
        else:
            order_instruction = "Online ordering is currently closed. Ask them to contact support for manual orders."
            return order_instruction
    except Exception as e:
        logger.error(f"Settings Error: {e}")
        order_instruction = "Handle orders politely."
        return order_instruction

def perform_rag_search(agent_config, text, post_context_text, order_instruction, existing_vector=None):
    sheet_context = ""
    extra_instruction = ""
    query_vector = existing_vector  # Initialize query_vector for later reuse
    rag_query = f"{post_context_text} {text}" if post_context_text else text
    
    try:
        if not query_vector:
            # OPTIMIZATION: Only generate embedding if user has knowledge base
            has_spread_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user).exists()
            has_doc_knowledge = DocumentKnowledge.objects.filter(user=agent_config.user).exists()
            
            if not has_spread_knowledge and not has_doc_knowledge:
                logger.info(f"⏭️ Skipping embedding: User {agent_config.user.email} has no records in Knowledge bases.")
                return "", "Answer naturally using your knowledge.", None

            skip_embedding = False

            if len(text) < 3:
                skip_embedding = True
                logger.info("embedding skipped due to length < 3.")
            else:
                matched_embedding_skips = check_keyword_match(text, 'embedding_skip')
                if matched_embedding_skips:
                    skip_embedding = True
                    logger.info(f"Keyword '{matched_embedding_skips[0]}' found. Skipping embedding.")
        
            if not skip_embedding:
                logger.info(f"Generating Gemini Embedding inside perform_rag_search for '{text[:20]}'")
                query_vector = get_gemini_embedding(rag_query)
                logger.info(f"DEBUG: Vector Generated: {True if query_vector else False}")
        else:
            logger.info("Using existing query_vector passed to perform_rag_search")
        
        if query_vector:
            # Search Spreadsheet Knowledge
            related_sheets = SpreadsheetKnowledge.objects.filter(
                user=agent_config.user
            ).annotate(
                distance=CosineDistance('embedding', query_vector)
            ).filter(distance__lt=0.65).order_by('distance')[:3]

            # Search Document Knowledge
            related_docs = DocumentKnowledge.objects.filter(
                user=agent_config.user
            ).select_related('document').annotate(
                distance=CosineDistance('embedding', query_vector)
            ).filter(distance__lt=0.65).order_by('distance')[:3]

            first_sheet = related_sheets.first()
            first_doc = related_docs.first()
            # 🔥 FIX: Safe float conversion and None check
            best_sheet_distance = float(first_sheet.distance) if (first_sheet and first_sheet.distance is not None) else 1.0
            best_doc_distance = float(first_doc.distance) if (first_doc and first_doc.distance is not None) else 1.0
            overall_best_dist = min(best_sheet_distance, best_doc_distance)
            
            # Combine contents based on distance thresholds
            matched_content = []
            matched_content.extend([f"[Source: Spreadsheet] {doc.content}" for doc in related_sheets])
            for doc in related_docs:
                title = doc.document.title if doc.document else doc.doc_title
                matched_content.append(f"[Source: Document - {title}] {doc.content}")

            if matched_content:
                unique_content = list(dict.fromkeys(matched_content))
                clean_data = "\n".join(unique_content)
                sheet_context = f"\n[KNOWLEDGE BASE DATA]:\n{clean_data}"
                post_info = f"User commented on this post: '{post_context_text}'. " if post_context_text else ""


                if overall_best_dist < 0.45:
                    extra_instruction = f"""
                            {post_info}  strictly using only the content inside [KNOWLEDGE BASE DATA].
                            Keep it short, clear, friendly, natural, conversational..
                            No markdown, no bold text, no formatting.
                            If appropriate, end with a short, warm follow-up question that encourages the user to continue.
                            {order_instruction}
                            """
                    logger.info(f">>> Strong RAG Match! overall best distance: {overall_best_dist}")
                else:
                    extra_instruction = f"""
                    You may use [KNOWLEDGE BASE DATA] if relevant.
                    If not, answer politely using your knowledge.
                    {order_instruction}
                    """
                    logger.info(f">>> Weak RAG Match! overall best distance: {overall_best_dist}")
            else:
                sheet_context = ""
                extra_instruction = f"""
                Answer naturally using your knowledge.
                If unsure, politely ask for clarification.
                {order_instruction}
                """
                logger.info(f">>> No useful RAG match. overall best distance: {overall_best_dist}")
        else:
            extra_instruction = f"""
            Answer naturally using your knowledge.
            {order_instruction}
            """
            logger.info(">>> Embedding skipped due to keyword + message length.")
    except Exception as e:
        logger.error(f"RAG Search Error: {e}", exc_info=True)
        extra_instruction = f" Answer politely. If data missing, ask to wait. {order_instruction}"
    return sheet_context, extra_instruction, query_vector

def check_token_availability(user_profile, ai_model_name):
    """
    Checks if user has any active subscription that allows the given model
    and has remaining tokens.
    """
    from users.models import Subscription
    from django.utils import timezone
    
    return Subscription.objects.filter(
        profile=user_profile,
        is_active=True,
        end_date__gt=timezone.now(),
        remaining_tokens__gt=0,
        offer__allowed_models__model_id=ai_model_name
    ).exists()

def deduct_user_tokens(user_profile, total_tokens, ai_model_name):
    if total_tokens > 0:
        try:
            from users.models import Subscription
            from django.utils import timezone
            
            remaining_to_deduct = total_tokens
            
            # Fetch all matching active subscriptions ordered by end_date (earliest first)
            subs = Subscription.objects.filter(
                profile=user_profile,
                is_active=True,
                end_date__gt=timezone.now(),
                remaining_tokens__gt=0,
                offer__allowed_models__model_id=ai_model_name
            ).order_by('end_date')

            for sub in subs:
                if remaining_to_deduct <= 0:
                    break
                
                if sub.remaining_tokens > remaining_to_deduct:
                    # Current sub has more than enough
                    sub.remaining_tokens -= remaining_to_deduct
                    
                    # Send low tokens notification (10% threshold)
                    try:
                        threshold = sub.offer.tokens * 0.1
                        if sub.remaining_tokens <= threshold and (sub.remaining_tokens + remaining_to_deduct) > threshold:
                            from chat.models import Notification
                            Notification.objects.create(
                                user=user_profile.user,
                                message=f"Low tokens alert! Offer '{sub.offer.name}' has less than 10% tokens remaining.",
                                type='low_tokens'
                            )
                    except Exception as e:
                        logger.error(f"Low Tokens Notification Error: {e}")
                        
                    remaining_to_deduct = 0
                    sub.save()
                    logger.info(f"Deducted tokens from Sub {sub.id}. Remaining: {sub.remaining_tokens}")
                else:
                    # Current sub is exhausted or exactly matches
                    remaining_to_deduct -= sub.remaining_tokens
                    sub.remaining_tokens = 0
                    sub.is_active = False
                    sub.save()
                    
                    # Send exhausted notification
                    try:
                        from chat.models import Notification
                        Notification.objects.create(
                            user=user_profile.user,
                            message=f"Offer '{sub.offer.name}' tokens have been exhausted.",
                            type='tokens_exhausted'
                        )
                    except Exception as e:
                        logger.error(f"Exhausted Notification Error: {e}")
                    
                    logger.info(f"Sub {sub.id} exhausted. Still need to deduct {remaining_to_deduct}")

            # Final sync of global balance
            user_profile.sync_word_balance()
            
            if remaining_to_deduct > 0:
                logger.warning(f"Overdraft! Still needed to deduct {remaining_to_deduct} for {user_profile.user.email}")
            
        except Exception as e:
            logger.error(f"Token Deduction Error: {e}")

def build_ai_context(agent_config, sender_id, text, extra_instruction=None, sheet_context=None):
    from aiAgent.utils import get_memory_context
    from chat.services import get_last_message
    from aiAgent.memory_handler import calculate_context_score, check_keyword_match

    lower_text = text.lower()
    memory_context = ""
    
    # 1. Fallback Static Triggers
    static_triggers = ['আমার অর্ডার', 'আমার নাম', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']
    
    # 2. Dynamic DB-backed Keyword Triggers 
    matched_intents = check_keyword_match(text, 'intent')
    matched_targets = check_keyword_match(text, 'target')
    
    # 3. Context Score checking (Phone, Email, Location, Urgency)
    c_score = calculate_context_score(text)
    
    is_memory_needed = False
    if any(word in lower_text for word in static_triggers):
        is_memory_needed = True
    elif matched_intents or matched_targets:
        is_memory_needed = True
    elif c_score >= 3:
        is_memory_needed = True

    if is_memory_needed:
        mem_data = get_memory_context(agent_config, sender_id)
        if mem_data:
            memory_context = f"\nUser Database Memory [Very Important]:\n{mem_data}"
            logger.info(f"🧠 Injecting Memory Context for {sender_id}. Score: {c_score} | DB Triggers: {matched_intents or matched_targets}")

    prompt_parts = [
        f"Role: {agent_config.system_prompt}",
        f"Instructions: {extra_instruction}"
    ]

    if sheet_context: prompt_parts.append(sheet_context)
    if memory_context: prompt_parts.append(memory_context)

    prompt_parts.append(f"\nUser: {text}")
    prompt_parts.append("Assistant:")
    full_prompt = "\n\n".join(prompt_parts)

    logger.info(f"\n======= FINAL PROMPT SENT TO AI =======\n{full_prompt}\n=======================================")

    raw_history = get_last_message(agent_config, sender_id, limit=3)
    
    skip_history = False
    matched_history_skips = check_keyword_match(text, 'history_skip')
    if matched_history_skips:
        skip_history = True
        logger.info(f"⏭️ Skipping history: DB Keyword '{matched_history_skips[0]}' found.")
            
    if skip_history:
        history = []
    else:
        history = [
            msg for msg in raw_history
            if msg.get("content") and msg.get("content").strip()
        ]
    return full_prompt, history

def get_ai_response(agent_config, full_prompt, history):
    """
    Unified AI handler that dispatches to specific providers.
    """
    from aiAgent.gemini import generate_gemini_reply
    from aiAgent.openai import generate_openai_reply
    from aiAgent.grok import generate_grok_reply
    from aiAgent.openrouter import generate_openrouter_reply
    # --- [DEBUG START] ---
    logger.info("🛠️ --- AI DISPATCHER DEBUG START ---")
    logger.info(f"🛠️ Agent ID: {agent_config.id} | Page ID: {agent_config.page_id}")
    logger.info(f"🛠️ Config AI Model (Legacy): {agent_config.ai_model}")
    # 1. Determine model and provider
    if agent_config.selected_model:
        logger.info(f"🛠️ Selected Model Found: {agent_config.selected_model.name}")
        logger.info(f"🛠️ Provider Detected: {agent_config.selected_model.provider}")
        model_name = agent_config.selected_model.model_id
        provider = agent_config.selected_model.provider # gemini, openai, grok, openrouter
    else:
        # Fallback to legacy field
        logger.warning("⚠️ WARNING: selected_model is NULL! Falling back to legacy fields.")
        model_name = agent_config.ai_model
        provider = 'openai' if 'gpt' in model_name.lower() else 'gemini'
        logger.info(f"🛠️ Fallback Provider: {provider} | Fallback Model: {model_name}")
    logger.info(f"🚀 FINAL DISPATCH: Provider={provider}, Model={model_name}")
    logger.info("🛠️ --- AI DISPATCHER DEBUG END ---")
    ai_response = None
    
    try:
        # 2. Dispatch based on provider
        if provider == 'openai':
            ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
        elif provider == 'grok':
            logger.info("🔥 CALLING GROK PROVIDER...")
            ai_response = generate_grok_reply(full_prompt, history, agent_config=agent_config)
        elif provider == 'openrouter':
            logger.info("🌐 CALLING OPENROUTER PROVIDER...")
            ai_response = generate_openrouter_reply(full_prompt, history, agent_config=agent_config)
        elif provider == 'gemini':
            logger.info("♊ CALLING GEMINI PROVIDER...")
            ai_response = generate_gemini_reply(full_prompt, history, agent_config=agent_config)
        else:
            logger.error(f"🚨 UNKNOWN PROVIDER '{provider}'. Defaulting to Gemini/OpenAI logic.")
            if 'gpt' in model_name.lower():
                ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
            else:
                ai_response = generate_gemini_reply(full_prompt, history, agent_config=agent_config)
            
        logger.info(f"🔍 [Provider: {provider}] AI Raw Data: {ai_response}")

        # 3. Handle Dictionary Format
        if isinstance(ai_response, dict):
            raw_reply = ai_response.get('reply', "")
            reply = raw_reply if raw_reply else ai_response.get('error_message', "System busy.")
            
            input_tokens = ai_response.get('input_tokens', 0)
            output_tokens = ai_response.get('output_tokens', 0)
            total_tokens = ai_response.get('total_tokens', 0)
            status = ai_response.get('status', 'unknown')
            
            reply = str(reply).replace('**', '').replace('*', '').strip()
            
            # If explicit failure status is given, rely on it
            if status in ['error', 'empty_response', 'failed']:
                success = False
            else:
                success = (status == 'success') or (len(reply) > 5 and "System busy" not in reply)
                
            error_info = ai_response.get('error_message') if not success else ""
            
            return {
                'reply': reply, 
                'total_tokens': total_tokens, 
                'success': success,
                'input_tokens': input_tokens, 
                'output_tokens': output_tokens, 
                'error': error_info
            }
        else:
            if isinstance(ai_response, tuple):
                reply_text, total_tokens = ai_response
            else:
                reply_text, total_tokens = str(ai_response), 0
                
            clean_reply = str(reply_text).replace('**', '').replace('*', '').strip()
            
            return {
                'reply': clean_reply,
                'total_tokens': total_tokens,
                'success': len(clean_reply) > 2,
                'input_tokens': int(total_tokens * 0.5),
                'output_tokens': total_tokens - int(total_tokens * 0.5),
                'error': ""
            }

    except Exception as e:
        logger.error(f"AI Wrapper Critical Error: {str(e)}", exc_info=True)
        return {
            'reply': "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later!", 
            'total_tokens': 0, 
            'success': False, 
            'error': str(e)
        }

def deliver_reply_to_n8n(data, reply, page_id, access_token):
    """Deliver final reply — routes WhatsApp to Baileys, Facebook to n8n"""
    import os
    request_type = str(data.get('type', 'messenger'))

    # ─── WhatsApp: সরাসরি Baileys-এ পাঠান ───────────────────────────────────
    if request_type == 'whatsapp':
        baileys_url = os.environ.get('BAILEYS_API_URL', 'http://newsmartagent-baileys:3001')
        baileys_secret = os.environ.get('BAILEYS_API_SECRET', 'changeme123')
        sender_id = str(data.get('sender_id', ''))

        # phone format: 880XXXXXXXXX → 880XXXXXXXXX@s.whatsapp.net
        to = sender_id if '@' in sender_id else f"{sender_id}@s.whatsapp.net"

        payload = {"to": to, "message": str(reply)}
        try:
            logger.info(f"📲 Sending WhatsApp reply to {to} via Baileys")
            response = requests.post(
                f"{baileys_url}/send-message",
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "x-api-secret": baileys_secret,
                },
                timeout=15,
            )
            if response.status_code != 200:
                logger.error(f"Baileys error: {response.status_code} - {response.text}")
                return False
            return True
        except Exception as e:
            logger.error(f"Baileys delivery failure: {e}")
            return False

    # ─── Facebook (Messenger / Comment): n8n-এ পাঠান ────────────────────────
    webhook_url = "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery"
    payload = {
        "sender_id": str(data.get('sender_id', '')),
        "reply": str(reply),
        "page_id": str(page_id),
        "page_access_token": str(access_token),
        "type": request_type,
        "comment_id": str(data.get('comment_id', '')),
        "post_id": str(data.get('post_id', ''))
    }

    try:
        logger.info(f"Sending payload to n8n: {payload}")
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f"n8n returned error: {response.status_code} - {response.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Webhook delivery critical failure: {e}")
        return False

def deliver_dashboard_reply(user_id, reply_text, message_id):
    """Deliver final reply to the dashboard via WebSocket and update the log"""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from aiAgent.models import DashboardAILog

        # Update log
        DashboardAILog.objects.filter(message_id=message_id).update(answer=reply_text)

        # Send via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "DASHBOARD_AI_REPLY",
                    "message_id": message_id,
                    "reply": reply_text
                }
            }
        )
        logger.info(f"✅ Dashboard reply sent via WebSocket for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Dashboard WebSocket delivery failure: {e}")
        return False

def log_token_usage(agent_config, sender_id, ai_data, duration, request_type):
    try:
        effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model
        TokenUsageLog.objects.create(
            user=agent_config.user,
            ai_agent=agent_config,
            sender_id=sender_id,
            model_name=effective_model,
            input_tokens=ai_data.get('input_tokens', 0),
            output_tokens=ai_data.get('output_tokens', 0),
            total_tokens=ai_data.get('total_tokens', 0),
            response_time=duration,
            success=ai_data.get('success', False),
            error_message=ai_data.get('error', ''),
            request_type=request_type
        )
    except Exception as e:
        logger.error(f"Logging Error: {e}")

def acquire_user_lock(task_instance, redis_client, sender_id):
    lock_key = f"chat_lock:{sender_id}"
    lock_value = str(uuid.uuid4())
    is_locked = redis_client.set(lock_key, lock_value, nx=True, ex=150)
    if not is_locked:
        logger.info(f"User {sender_id} busy. Retrying...")
        raise task_instance.retry(countdown=5)
    return is_locked, lock_key, lock_value

def is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, redis_client):
    if msg_id:
        # 1. Check if already permanently processed
        if redis_client.get(f'processed_msg:{msg_id}'):
            logger.info(f"Duplicate message detected (Already Processed): {msg_id}")
            return True
        
        # 2. Check if currently being processed (Race Condition Prevention)
        # We use a 'processing' key with 60s expiry to ensure one worker handles it
        if not redis_client.set(f'processing_msg:{msg_id}', '1', nx=True, ex=60):
            logger.info(f"⏭️ Task Already in Progress for msg_id: {msg_id}")
            return True

    if incoming_ts:
        try:
            incoming_ts = float(incoming_ts)
            if incoming_ts > 1e12: incoming_ts /= 1000
            latest = get_last_message(agent_config, sender_id, limit=1)
            if latest and latest[0].get('timestamp', 0) > incoming_ts:
                logger.info(f"Zombie Outdated task detected for {sender_id}. Skipping.")
                return True
        except (ValueError, TypeError) as e:
            logger.error(f"Zombie Check Error: {e}")
    return False

def handle_public_comment_logic(data, agent_config, r):
    sender_id = str(data.get('sender_id', ''))
    page_id = str(data.get('page_id', ''))
    comment_id = data.get('comment_id')
    request_type = data.get('type')

    if sender_id == page_id:
        return False, "page_own_activity"

    if request_type == 'facebook_comment' and comment_id:
        comment_lock_key = f'processed_comment:{comment_id}'
        if not r.get(comment_lock_key):
            from webhooks.comment import deliver_public_comment_reply
            reply_text = 'ধন্যবাদ! আপনার ইনবক্স চেক করুন, বিস্তারিত পাঠানো হয়েছে। 😊'
            r.set(comment_lock_key, '1', ex=3600)
            deliver_public_comment_reply(comment_id, reply_text, agent_config.access_token)
            return True, "public_reply_sent"
    return True, "continue"
