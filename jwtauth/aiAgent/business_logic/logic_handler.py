# aiAgent/business_logic/logic_handler.py
from celery import shared_task
import requests

from aiAgent.models import AgentAI
from chat.services import save_message
from aiAgent.models import AgentAI, MissingRequirement, TokenUsageLog
from aiAgent.memory_service import extract_and_update_memory
from aiAgent.memory_handler import handle_smart_memory_update
from webhooks.constants import TARGET_KEYWORDS, embedding_skip_keyword
from aiAgent.data_processor import processor_spreadsheet_data
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import time
from embedding.models import SpreadsheetKnowledge
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
    



def perform_rag_search(agent_config, text, post_context_text, order_instruction):
    sheet_context = ""
    extra_instruction = ""
    rag_query = f"{post_context_text} {text}" if post_context_text else text
    
    try:
    
        skip_margin = 10
        skip_embedding = False
        text_len = len(text)
        
        for kw in embedding_skip_keyword:
            kw_len = len(kw)
            # flexible check: message length ~ keyword length ± margin
            if kw.lower() in text.lower() and abs(text_len - kw_len) <= skip_margin:
                skip_embedding = True
                logger.info(f"Keyword '{kw}' found and message length within margin. Skipping embedding.")
                break
            if len(text) < 3:
                skip_embedding = True
                logger.info("embeddign has been skiping because the message length is less than 3characters.")
                break
        
        #<!------------------- Convert user message to vector -----------------------!>
        query_vector = None
        if not skip_embedding:
            query_vector = get_gemini_embedding(rag_query)
            logger.info(f"DEBUG: Vector Generated: {True if query_vector else False}")
        if query_vector:
            #<!------------------ Finding the 3 most relevant rows from a vector database ---------------!>
            related_docs = SpreadsheetKnowledge.objects.filter(
                user=agent_config.user
            ).annotate(
                distance=CosineDistance('embedding', query_vector)
            ).order_by('distance')[:3]

       
            if related_docs:
                top_distance = related_docs[0].distance
                if top_distance < 0.45:
                                # Strong match
                    matched_content = [doc.content for doc in related_docs]
                    clean_data = "\n".join(matched_content)
                    sheet_context = f"\n[DATA]:\n{clean_data}"
                    post_info = f"User commented on this post: '{post_context_text}'. " if post_context_text else ""
                    extra_instruction = f"""
                            {post_info}  strictly using only the content inside [DATA].
                            Keep it short, clear, friendly, natural, conversational..
                            No markdown, no bold text, no formatting.
                            If appropriate, end with a short, warm follow-up question that encourages the user to continue.
                            {order_instruction}
                            """
                    logger.info(f">>> Strong RAG Match! Distance: {top_distance}")
                
                elif top_distance < 0.65:
                    # Weak match
                    matched_content = [doc.content for doc in related_docs]
                    sheet_context = f"\n[DATA]:\n{'\n'.join(matched_content)}"
                    extra_instruction = f"""
                    You may use [DATA] if relevant.
                    If not, answer politely using your knowledge.
                    {order_instruction}
                    """
                    logger.info(f">>> Weak RAG Match! Distance: {top_distance}")
                else:
                     # No good match
                    sheet_context = ""
                    extra_instruction = f"""
                    Answer naturally using your knowledge.
                    If unsure, politely ask for clarification.
                    {order_instruction}
                    """
                    logger.info(f">>> No useful RAG match. Distance: {top_distance}")
            else:
                # Embedding skipped
                extra_instruction = f"""
                Answer naturally using your knowledge.
                {order_instruction}
                """
                logger.info(">>> Embedding skipped due to keyword + message length.")
    except Exception as e:
        logger.error(f"RAG Search Error: {e}")
        extra_instruction = f" Answer politely. If data missing, ask to wait. {order_instruction}"
    return sheet_context, extra_instruction
    
def deduct_user_tokens(user_profile, total_tokens):
    if total_tokens > 0:
        try:
            user_profile.word_balance = F('word_balance') - total_tokens
            user_profile.save(update_fields=['word_balance'])
            user_profile.refresh_from_db()
            logger.info(f"Deducted {total_tokens} tokens. Remaining: {user_profile.word_balance}")
        except Exception as e:
            logger.error(f"Token Deduction Error: {e}")


def build_ai_context(agent_config, sender_id, text, extra_instruction=None, sheet_context=None):
    """
    Build final prompt + clean history
    """

    from aiAgent.utils import get_memory_context
    from chat.services import get_last_message

    lower_text = text.lower()
    memory_context = ""

    memory_triggers = ['আমার', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']

    if any(word in lower_text for word in memory_triggers):
        mem_data = get_memory_context(agent_config, sender_id)
        if mem_data:
            memory_context = f"\nMemory Context:\n{mem_data}"

    prompt_parts = [
        f"Role: {agent_config.system_prompt}",
        f"Instructions: {extra_instruction}"
    ]

    if sheet_context: prompt_parts.append(sheet_context)
    if memory_context: prompt_parts.append(memory_context)

    # 5️⃣ Current user message
    prompt_parts.append(f"\nUser: {text}")
    prompt_parts.append("Assistant:")

    full_prompt = "\n\n".join(prompt_parts)

    logger.info(f"\n======= FINAL PROMPT SENT TO AI =======\n{full_prompt}\n=======================================")

    # Clean history (no empty messages)
    raw_history = get_last_message(agent_config, sender_id, limit=3)
    history = [
        msg for msg in raw_history
        if msg.get("message") and msg.get("message").strip()
    ]

    return full_prompt, history


def get_ai_response(agent_config, full_prompt, history):
    from aiAgent.gemini import generate_reply
    from aiAgent.openai import generate_openai_reply
    
    model_choice = agent_config.ai_model.lower()
    ai_response = None
    
    try:
        # ১. মডেল অনুযায়ী কল করা
        if 'gpt' in model_choice:
            ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
        else:
            ai_response = generate_reply(full_prompt, history, agent_config=agent_config)
            
        # --- DEBUG LOGS ---
        logger.info(f"🔍 AI Raw Response Type: {type(ai_response)}")
        logger.info(f"🔍 AI Raw Data: {ai_response}")

        # ২. ডিকশনারি ফরম্যাট হ্যান্ডলিং (আপনার নতুন সিস্টেম)
        if isinstance(ai_response, dict):
            # রিপ্লাইটি বের করা এবং পরিষ্কার করা
            raw_reply = ai_response.get('reply', "")
            # যদি reply না থাকে তবে fallback হিসেবে error_message বা ডিফল্ট টেক্সট
            reply = raw_reply if raw_reply else ai_response.get('error_message', "System busy.")
            
            # মেটা ডাটা এক্সট্রাকশন
            input_tokens = ai_response.get('input_tokens', 0)
            output_tokens = ai_response.get('output_tokens', 0)
            total_tokens = ai_response.get('total_tokens', 0)
            status = ai_response.get('status', 'unknown')
            
            # ফরম্যাটিং ক্লিনআপ (বোল্ড বা ইটালিক সাইন রিমুভ)
            reply = str(reply).replace('**', '').replace('*', '').strip()
            
            # সাকসেস লজিক: স্ট্যাটাস সাকসেস হওয়া অথবা রিপ্লাই এর একটা মিনিমাম লেংথ থাকা
            # (আপনার আগের ৫ অক্ষরের লজিকটাই রাখলাম, তবে status ছাড়াও চেক করবে)
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

        # ৩. ফলব্যাক: যদি এআই সরাসরি স্ট্রিং বা টিউপল পাঠায়
        else:
            logger.warning("⚠️ AI Response is NOT a dictionary! Using fallback logic.")
            
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
    """n8n-এ ফাইনাল রিপ্লাই ডেলিভারি করে এবং JSON ভ্যালিডেশন নিশ্চিত করে"""
    webhook_url = "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery"
    
    # নিশ্চিত করুন কোনো ভ্যালু যেন None না থাকে (Empty string দিয়ে রিপ্লেস করা)
    payload = {
        "sender_id": str(data.get('sender_id', '')),
        "reply": str(reply),
        "page_id": str(page_id),
        "page_access_token": str(access_token),
        "type": str(data.get('type', 'messenger')),
        "comment_id": str(data.get('comment_id', '')),
        "post_id": str(data.get('post_id', ''))
    }

    try:
        # টাইপ চেক করার জন্য লগ দিন
        logger.info(f"Sending payload to n8n: {payload}")
        
        response = requests.post(
            webhook_url, 
            json=payload, # json= প্যারামিটার ব্যবহার করলে requests নিজেই Header সেট করে
            timeout=15
        )
        
        if response.status_code != 200:
            logger.error(f"n8n returned error: {response.status_code} - {response.text}")
            return False
            
        return True
    except Exception as e:
        logger.error(f"Webhook delivery critical failure: {e}")
        return False

def log_token_usage(agent_config, sender_id, ai_data, duration, request_type):
    try:
        TokenUsageLog.objects.create(
            user=agent_config.user,
            ai_agent=agent_config,
            sender_id=sender_id,
            model_name=agent_config.ai_model,
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
    # -------------------- SAFE REDIS LOCK -------------------- #
    lock_key = f"chat_lock:{sender_id}"
    lock_value = str(uuid.uuid4())
    is_locked = redis_client.set(lock_key, lock_value, nx=True, ex=150)
    if not is_locked:
        logger.info(f"User {sender_id} busy. Retrying...")
        raise task_instance.retry(countdown=2)
    return is_locked, lock_key, lock_value


def is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, redis_client):
    
    # ---------- IDEMPOTENCY CHECK (BEFORE LOCK) ----------
    if msg_id and redis_client.get(f'processed_msg:{msg_id}'):
        logger.info(f"Duplicate message detected: {msg_id}")
        return True
    
    # ২. Zombie (Outdated) Check
    if incoming_ts:
        try:
            incoming_ts = float(incoming_ts)
            if incoming_ts > 1e12: incoming_ts /= 1000 # ms to s conversion
            
            from chat.services import get_last_message
            latest = get_last_message(agent_config, sender_id, limit=1)
            
            if latest and latest[0].get('timestamp', 0) > incoming_ts:
                logger.info(f"🧟 Outdated task detected for {sender_id}. Skipping.")
                return True
        except (ValueError, TypeError) as e:
            logger.error(f"Zombie Check Error: {e}")
            
    return False
