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
from aiAgent.models import WebsiteVisitor
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
        logger.info(f'[Logic] Routing Telegram reply via n8n | chat={chat_id} | url={webhook_url}')
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f'[Logic] n8n Telegram delivery error: {response.status_code} - {response.text}')
            return False
        logger.info(f'[Logic] n8n Telegram delivery ok: {response.status_code}')
        return True
    except Exception as e:
        logger.error(f'[Logic] Telegram delivery critical failure: {e}')
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
                from aiAgent.models import SmartKeyword
                db_skip_keywords = SmartKeyword.objects.filter(category='embedding_skip').values_list('text', flat=True)
                skip_margin = 6
                text_len = len(text)
                for kw in db_skip_keywords:
                    if kw.lower() in text.lower() and abs(text_len - len(kw)) <= skip_margin:
                        skip_embedding = True
                        logger.info(f"Keyword '{kw}' found via substring margin guard. Skipping embedding.")
                        break
        
            if not skip_embedding:
                logger.info(f"Generating Gemini Embedding inside perform_rag_search for '{text[:20]}'")
                query_vector = get_gemini_embedding(rag_query)
                logger.info(f"DEBUG: Vector Generated: {True if query_vector else False}")
        else:
            logger.info("Using existing query_vector passed to perform_rag_search")
        
        if query_vector:
            # 🔍 Scope Filtering logic:
            # - Global (সব এজেন্ট পাবে)
            # - Agent Specific (শুধু এই নির্দিষ্ট এজেন্ট পাবে)
            
            from django.db.models import Q
            from datasheet.models import Spreadsheet
            from embedding.models import Document
            
            # ১. ভ্যালিড স্প্রেডশিট আইডি বের করা (Scope অনুযায়ী)
            valid_sheet_ids = Spreadsheet.objects.filter(
                user=agent_config.user
            ).filter(
                Q(scope='global') | Q(scope='agent_specific', agent=agent_config)
            ).values_list('id', flat=True)
            
            # ২. ভ্যালিড ডকুমেন্ট আইডি বের করা (Scope অনুযায়ী)
            valid_doc_ids = Document.objects.filter(
                user=agent_config.user
            ).filter(
                Q(scope='global') | Q(scope='agent_specific', agent=agent_config)
            ).values_list('id', flat=True)

            # Search Spreadsheet Knowledge (Row IDs Prefix filtering)
            # SpreadsheetKnowledge-এর row_id ফর্মেট: "sheet_{id}_row_{r_idx}"
            sheet_query = Q()
            for s_id in valid_sheet_ids:
                sheet_query |= Q(row_id__startswith=f"sheet_{s_id}_")

            related_sheets = SpreadsheetKnowledge.objects.none()
            if valid_sheet_ids:
                related_sheets = SpreadsheetKnowledge.objects.filter(
                    user=agent_config.user
                ).filter(sheet_query).annotate(
                    distance=CosineDistance('embedding', query_vector)
                ).filter(distance__lt=0.65).order_by('distance')[:3]

            # Search Document Knowledge
            related_docs = DocumentKnowledge.objects.filter(
                user=agent_config.user,
                document_id__in=valid_doc_ids
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
        extra_instruction = f' Answer politely. If data missing, ask to wait and set "human_handoff": true if human help is needed. {order_instruction}'
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

            # Trigger auto-renew if balance is low
            try:
                from users.services.auto_renew_service import check_and_trigger_auto_renew
                check_and_trigger_auto_renew(user_profile)
            except Exception as e:
                logger.error(f"Auto-renew Trigger Error: {e}")
            
            if remaining_to_deduct > 0:
                logger.warning(f"Overdraft! Still needed to deduct {remaining_to_deduct} for {user_profile.user.email}")
            
        except Exception as e:
            logger.error(f"Token Deduction Error: {e}")

def build_ai_context(agent_config, sender_id, text, extra_instruction=None, sheet_context=None, platform='messenger'):
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

    # 3.5 Visitor Tracking Context
    visitor_context = ""
    try:
        visitor = WebsiteVisitor.objects.filter(visitor_uuid=sender_id).first()
        if visitor:
            v_info = []
            if visitor.location: v_info.append(f"Location: {visitor.location}")
            v_info.append(f"Total Visits: {visitor.view_count}")
            if visitor.captured_email: v_info.append(f"Email: {visitor.captured_email}")
            if visitor.captured_phone: v_info.append(f"Phone: {visitor.captured_phone}")
            
            if v_info:
                visitor_context = "\n[VISITOR TRACKING DATA]:\n" + " | ".join(v_info)
                visitor_context += "\nDirective: Use this data for a personalized greeting if this is a returning visitor or if location/contact info is relevant. Be natural."
                logger.info(f"📊 Injecting Visitor Context for {sender_id}")
    except Exception as e:
        logger.error(f"Error fetching visitor context: {e}")

    # 4. Fetch Contact specific settings
    from aiAgent.models import Contact
    custom_role = agent_config.system_prompt
    contact_instructions = extra_instruction or ""

    try:
        contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        if contact:
            if contact.custom_prompt:
                custom_role = contact.custom_prompt
                logger.info(f"🎯 Using Custom Role for {sender_id}")
            if contact.custom_instructions:
                contact_instructions = f"{contact_instructions}\n[CONTACT SPECIFIC INSTRUCTIONS]: {contact.custom_instructions}"
                logger.info(f"📝 Adding Custom Instructions for {sender_id}")
    except Exception as e:
        logger.error(f"Error fetching contact settings: {e}")

    system_prompt_parts = [
        f"Identity: Always identify you are assistant of the {agent_config.name} if asked.",
        f"Role: {custom_role}",
        f"Instructions: {contact_instructions}"
    ]

    if sheet_context: system_prompt_parts.append(sheet_context)
    if memory_context: system_prompt_parts.append(memory_context)
    if visitor_context: system_prompt_parts.append(visitor_context)

    system_instruction = "\n\n".join(system_prompt_parts)

    logger.info(f"\n======= SYSTEM INSTRUCTION =======\n{system_instruction}\n=======================================")
    logger.info(f"\n======= CURRENT USER MSG =======\n{text}\n=======================================")

    raw_history = get_last_message(agent_config, sender_id, limit=agent_config.get_settings.history_limit, platform=platform)
    
    settings = agent_config.get_settings
    skip_history = False
    if settings.skip_history:
        # Check global smart keywords
        matched_global = check_keyword_match(text, 'history_skip')
        
        # Check per-agent custom history skip keywords
        custom_skips = [k.strip().lower() for k in (settings.history_skip_keywords or "").split(',') if k.strip()]
        matched_custom = [k for k in custom_skips if k in text.lower()]
        
        if matched_global or matched_custom:
            skip_history = True
            logger.info(f"⏭️ Skipping history: Keyword found. Global: {matched_global}, Custom: {matched_custom}")

    if skip_history:
        history = []
    else:
        history = [
            msg for msg in raw_history
            if msg.get("content") and msg.get("content").strip()
        ]
    return system_instruction, history, text

def get_ai_response(agent_config, system_instruction, history, current_message):
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
            ai_response = generate_openai_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'grok':
            logger.info("🔥 CALLING GROK PROVIDER...")
            ai_response = generate_grok_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'openrouter':
            logger.info("🌐 CALLING OPENROUTER PROVIDER...")
            ai_response = generate_openrouter_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'gemini':
            logger.info("♊ CALLING GEMINI PROVIDER...")
            ai_response = generate_gemini_reply(system_instruction, history, current_message, agent_config=agent_config)
        else:
            logger.error(f"🚨 UNKNOWN PROVIDER '{provider}'. Defaulting to Gemini/OpenAI logic.")
            if 'gpt' in model_name.lower():
                ai_response = generate_openai_reply(system_instruction, history, current_message, agent_config=agent_config)
            else:
                ai_response = generate_gemini_reply(system_instruction, history, current_message, agent_config=agent_config)
            
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

def deliver_whatsapp_reply(data, reply):
    """Deliver final reply for WhatsApp via n8n webhook"""
    import os
    webhook_url = os.getenv("N8N_WHATSAPP_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/whatsapp-delivery")
    buttons = [
        {"id": "human_help" if not data.get('human_mode') else "resolve_human",
         "title": "🙋 Human Help" if not data.get('human_mode') else "✅ Resolve Human Mode"},
        {"id": "toggle_ai",
         "title": "🔊 On AI Reply" if data.get('stop_ai') else "🔇 Stop AI Reply"},
    ]
    final_target = data.get('delivery_jid') or data.get('sender_id', '')
    payload = {
        "to": str(final_target),
        "delivery_jid": str(data.get('delivery_jid', '')),
        "phone": str(data.get('sender_id', '')),
        "sender_id": str(data.get('sender_id', '')),
        "message": str(reply),
        "reply": str(reply),
        "type": "whatsapp",
        "message_id": str(data.get('message_id', '')),
        "sessionId": str(data.get('sessionId', '')),
        "buttons": buttons  # only option labels, no URLs
    }
    try:
        logger.info(f'[Logic] Routing WhatsApp reply via n8n | to={final_target} | url={webhook_url}')
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f'[Logic] n8n WhatsApp delivery error: {response.status_code} - {response.text}')
            return False
        logger.info(f'[Logic] n8n WhatsApp delivery ok: {response.status_code}')
        return True
    except Exception as e:
        logger.error(f"❌ [Logic] n8n WhatsApp delivery critical failure: {e}")
        return False


def deliver_instagram_reply(data, reply, page_id, access_token):
    """Deliver final reply for Instagram via n8n webhook (Separate Workflow)"""
    import os
    webhook_url = os.getenv("N8N_INSTAGRAM_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/instagram-delivery")
    payload = {
        "sender_id": str(data.get('sender_id', '')),
        "reply": str(reply),
        "page_id": str(page_id),
        "page_access_token": str(access_token),
        "type": "instagram",
        "message_id": str(data.get('message_id', '')),
    }

    try:
        logger.info(f'[Logic] Routing Instagram reply via n8n | page_id={page_id} | url={webhook_url}')
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f'[Logic] n8n Instagram delivery error: {response.status_code} - {response.text}')
            return False
        logger.info(f'[Logic] n8n Instagram delivery ok: {response.status_code}')
        return True
    except Exception as e:
        logger.error(f"❌ [Logic] n8n Instagram delivery critical failure: {e}")
        return False


def deliver_facebook_reply(data, reply, page_id, access_token):
    """Deliver final reply for Facebook (Messenger / Comment) via n8n webhook"""
    import os
    webhook_url = os.getenv("N8N_FACEBOOK_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery")
    request_type = str(data.get('type', 'messenger'))
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
        logger.info(f'[Logic] Routing Facebook reply via n8n | page_id={page_id} | url={webhook_url}')
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f'[Logic] n8n Facebook delivery error: {response.status_code} - {response.text}')
            return False
        logger.info(f'[Logic] n8n Facebook delivery ok: {response.status_code}')
        return True
    except Exception as e:
        logger.error(f"n8n Facebook delivery critical failure: {e}")
        return False

def deliver_telegram_reply(data, reply, token):
    """Deliver final reply for Telegram via n8n webhook (Separate Workflow)"""
    import os
    webhook_url = os.getenv("N8N_TELEGRAM_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/telegram-delivery")
    chat_id = data.get('chat_id') or data.get('sender_id')
    
    if not chat_id:
        logger.error("❌ [Logic] Missing chat_id for Telegram reply")
        return False
    
    if not token:
        logger.error("❌ [Logic] Missing bot token for Telegram reply")
        return False

    payload = {
        "chat_id": str(chat_id),
        "sender_id": str(data.get('sender_id', '')),
        "reply": str(reply),
        "access_token": str(token),  # Consistent with other delivery functions
        "platform": "telegram",
        "message_id": str(data.get('message_id', ''))
    }

    try:
        logger.info(f'[Logic] Routing Telegram reply via n8n | chat={chat_id} | url={webhook_url}')
        response = requests.post(
            webhook_url,
            json=payload,
            timeout=15
        )
        if response.status_code != 200:
            logger.error(f'[Logic] n8n Telegram delivery error: {response.status_code} - {response.text}')
            return False
        logger.info(f'[Logic] n8n Telegram delivery ok: {response.status_code}')
        return True
    except Exception as e:
        logger.error(f'[Logic] n8n Telegram delivery critical failure: {e}')
        return False

def get_button_payload(contact):
    """Generate button text and payload based on current contact state"""
    buttons = []
    
    # Button 1: Human Help / Resolve Human Mode
    if contact.is_human_needed:
        buttons.append({"text": "✅ Resolve Human Mode", "action": "RESOLVE_HUMAN"})
    else:
        buttons.append({"text": "🙋 Human Help", "action": "HUMAN_HELP"})
        
    # Button 2: Stop AI / On AI
    if contact.is_auto_reply_enabled:
        buttons.append({"text": "🔇 Stop AI Reply", "action": "STOP_AI_REPLY"})
    else:
        buttons.append({"text": "🔊 On AI Reply", "action": "ON_AI_REPLY"})
        
    return buttons

def send_telegram_buttons(chat_id, token, contact, reply_text="Options:"):
    """Send inline keyboard buttons after Telegram reply"""
    if not token or not chat_id:
        return False
        
    import os
    # We can reuse the telegram delivery webhook, but send buttons
    webhook_url = os.getenv("N8N_TELEGRAM_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/telegram-delivery")
    
    buttons = get_button_payload(contact)
    inline_keyboard = [
        [
            {"text": b["text"], "callback_data": b["action"]} for b in buttons
        ]
    ]
    
    payload = {
        "chat_id": str(chat_id),
        "access_token": str(token),
        "platform": "telegram",
        "reply": reply_text, # Minimal text as Telegram requires text with buttons
        "reply_markup": {"inline_keyboard": inline_keyboard}
    }
    
    try:
        logger.info(f'[Logic] Sending Telegram buttons to {chat_id}')
        requests.post(webhook_url, json=payload, timeout=10)
        return True
    except Exception as e:
        logger.error(f"Telegram button delivery error: {e}")
        return False

def send_messenger_buttons(sender_id, page_id, access_token, contact, reply_text="How would you like to proceed?"):
    """Send quick_reply buttons after Messenger reply"""
    if not access_token or not sender_id:
        return False
        
    import os
    webhook_url = os.getenv("N8N_FACEBOOK_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery")
    
    buttons = get_button_payload(contact)
    quick_replies = [
        {
            "content_type": "text",
            "title": b["text"][:20], # Messenger limit
            "payload": b["action"]
        } for b in buttons
    ]
    
    payload = {
        "sender_id": str(sender_id),
        "page_id": str(page_id),
        "page_access_token": str(access_token),
        "type": "messenger",
        "reply": reply_text,
        "quick_replies": quick_replies
    }
    
    try:
        logger.info(f'[Logic] Sending Messenger buttons to {sender_id}')
        requests.post(webhook_url, json=payload, timeout=10)
        return True
    except Exception as e:
        logger.error(f"Messenger button delivery error: {e}")
        return False

def send_instagram_buttons(sender_id, page_id, access_token, contact, reply_text="How would you like to proceed?"):
    """Send quick_reply buttons after Instagram reply"""
    if not access_token or not sender_id:
        return False
        
    import os
    webhook_url = os.getenv("N8N_INSTAGRAM_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/instagram-delivery")
    
    buttons = get_button_payload(contact)
    quick_replies = [
        {
            "content_type": "text",
            "title": b["text"][:20], # Instagram limit
            "payload": b["action"]
        } for b in buttons
    ]
    
    payload = {
        "sender_id": str(sender_id),
        "page_id": str(page_id),
        "page_access_token": str(access_token),
        "type": "instagram",
        "reply": reply_text,
        "quick_replies": quick_replies
    }
    
    try:
        logger.info(f'[Logic] Sending Instagram buttons to {sender_id}')
        requests.post(webhook_url, json=payload, timeout=10)
        return True
    except Exception as e:
        logger.error(f"Instagram button delivery error: {e}")
        return False

def send_whatsapp_buttons(data, contact, reply_text="Options:"):
    """Send button message via n8n for WhatsApp"""
    import os
    webhook_url = os.getenv("N8N_WHATSAPP_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/whatsapp-delivery")
    
    final_target = data.get('delivery_jid') or data.get('sender_id', '')
    if not final_target:
        return False
        
    buttons_data = get_button_payload(contact)
    
    # ── Text Menu Fallback (no URLs) ──
    # Meta/LID sometimes blocks interactive buttons; we send a plain numbered menu without links.
    menu_text = f"{reply_text}\n\n"
    menu_text += "--- 📝 *Select an Option* ---\n"
    
    for i, b in enumerate(buttons_data, 1):
        menu_text += f"{i}️⃣ *{b['text']}*\n"
        
    menu_text += f"\n⌨️ _You can also reply with 1{' or 2' if len(buttons_data) > 1 else ''}_"

    payload = {
        "to": str(final_target),
        "number": str(final_target),
        "delivery_jid": str(data.get('delivery_jid', '')),
        "phone": str(data.get('sender_id', '')),
        "sender_id": str(data.get('sender_id', '')),
        "message": menu_text,
        "reply": menu_text,
        "text": menu_text,
        "type": "whatsapp",
        "message_id": str(data.get('message_id', '')),
        "sessionId": str(data.get('sessionId', '')),
        "is_button_message": False
    }
    
    try:
        logger.info(f'[Logic] Sending WhatsApp buttons to {final_target}')
        requests.post(webhook_url, json=payload, timeout=10)
        return True
    except Exception as e:
        logger.error(f"WhatsApp button delivery error: {e}")
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

def log_token_usage(agent_config, sender_id, ai_data, duration, request_type, platform=None):
    try:
        effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model
        platform_value = platform or request_type or agent_config.platform or "messenger"
        TokenUsageLog.objects.create(
            user=agent_config.user,
            ai_agent=agent_config,
            sender_id=sender_id,
            model_name=effective_model,
            input_tokens=ai_data.get('input_tokens', 0),
            output_tokens=ai_data.get('output_tokens', 0),
            total_tokens=ai_data.get('total_tokens', 0),
            platform=platform_value,
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

def handle_ai_response(agent_id, sender_id, message_text, platform='web_widget'):
    """
    Unified synchronous handler for direct AI responses (like Web Widget).
    Handles context, RAG, AI call, token deduction, and logging.
    """
    start_time = time.time()
    try:
        agent_config = AgentAI.objects.get(id=agent_id)
        user_profile = agent_config.user.profile
        
        # 1. Token Check
        effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model
        if not check_token_availability(user_profile, effective_model):
            return "Sorry, the agent has run out of tokens. Please contact the site owner."

        # 2. Context & RAG
        order_instr = get_order_instructions(agent_config.user)
        sheet_ctx, extra_instr, query_vector = perform_rag_search(
            agent_config, message_text, "", order_instr
        )
        system_instruction, history, current_msg = build_ai_context(
            agent_config, sender_id, message_text, extra_instr, sheet_ctx, platform=platform
        )

        # 3. AI Call
        ai_data = get_ai_response(agent_config, system_instruction, history, current_msg)
        reply = ai_data.get('reply', 'System busy.')
        success = ai_data.get('success', False)
        total_tokens = ai_data.get('total_tokens', 0)

        if success:
            # 4. Token Deduction
            deduct_user_tokens(user_profile, total_tokens, effective_model)
            
            # 5. Save Messages
            save_message(agent_config, sender_id, message_text, 'user', platform=platform)
            save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens, platform=platform)
            
            # 6. Memory Update
            handle_smart_memory_update(agent_config, sender_id, message_text)

        # 7. Token Usage Log
        duration = int((time.time() - start_time) * 1000)
        log_token_usage(agent_config, sender_id, ai_data, duration, 'widget_direct', platform=platform)

        return reply

    except Exception as e:
        logger.error(f"Error in handle_ai_response: {e}", exc_info=True)
        return "I'm sorry, I'm having trouble processing your request right now."
