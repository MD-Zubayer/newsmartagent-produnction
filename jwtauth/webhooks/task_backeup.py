from celery import shared_task
import requests

from aiAgent.models import AgentAI
from chat.services import save_message, get_last_message
from aiAgent.gemini import generate_reply
from aiAgent.openai import generate_openai_reply
from aiAgent.models import AgentAI, MissingRequirement
from aiAgent.utils import get_memory_context
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

logger = logging.getLogger(__name__)



r = redis.Redis(host='newsmartagent-redis', port=6379, db=0)




# -------------------- TASK -------------------- #

@shared_task(
             bind=True,
             queue='chat_queue',
             expires=180,
             autoretry_for=(requests.exceptions.RequestException,),
             retry_backoff=True,
             max_retries=3,
             time_limit=70,
             soft_time_limit=60
             )
def process_ai_reply_task(self,data):

    start_time = time.time()

    sender_id = data.get('sender_id')
    page_id = data.get('page_id')
    request_type = data.get('type')
    text = data.get('comment_text') if request_type == 'facebook_comment' else data.get('message')
    msg_id = data.get('message_id')# Idempotency-র জন্য লাগবে
    incoming_ts = data.get('timestamp') # Zombie Killer

    
    if not all([sender_id, text, page_id]):
            logger.error(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}")
            return
        
# ---------- IDEMPOTENCY CHECK (BEFORE LOCK) ----------
    if msg_id and r.get(f'processed_msg:{msg_id}'):
        logger.info(f"Duplicate message detected: {msg_id}")
        return


    # -------------------- SAFE REDIS LOCK -------------------- #
    lock_key = f"chat_lock:{sender_id}"
    lock_value = str(uuid.uuid4())
    lock = r.set(lock_key, lock_value, nx=True, ex=150)
    if not lock:
        logger.info(f"User {sender_id} busy. Retrying...")
        raise self.retry(countdown=2)

    try:   
        
        
        try:
            agent_config = AgentAI.objects.get(page_id=page_id, is_active=True)
            # <!---------------User profile -------------------!>
            user_profile = agent_config.user.profile
        
        except Exception as e:
            logger.error(f'Error: Agent not found for page_id {page_id} - {e}')
            return
        
        
        model_choice = agent_config.ai_model.lower()
        reply = "System busy."
        input_tokens = 0
        output_tokens = 0
        total_tokens = 0
        success = False
        error_info = ""
        
    # ----------# 1️⃣ Normalize & cache check
        cached_res = get_cached_reply(page_id, text)
        if cached_res:
            reply = cached_res.get('reply')
            model_choice = cached_res.get('model', model_choice)
            success = True
            incr_counter(page_id, 'cache_hit')
            logger.info(f"⚡ CACHE HIT: Returning cached reply for '{text[:30]}'")

        else:
            incr_counter(page_id, 'cache_miss')
            logger.info(f"⚡ CACHE Miss: Returning cached reply for '{text[:30]}'")



        post_context_text = ""
        if request_type == 'facebook_comment':
            post_id = data.get('post_id')
            post_context_text = get_smart_post_context(post_id, agent_config.access_token)
            if post_context_text:
                logger.info(f">>> FB Post Context Loaded: {post_context_text[:50]}...")

           # ---------- STRONG ZOMBIE CHECK ----------

        if incoming_ts:
                try:
                    incoming_ts = float(incoming_ts)
                    if incoming_ts > 1e12: incoming_ts /= 1000
                    latest = get_last_message(agent_config, sender_id, limit=1)
                    if latest and latest[0].get('timestamp', 0) > incoming_ts:
                        logger.info("🧟 Outdated task detected. Skipping.")
                        return
                except (ValueError, TypeError): pass

        # ---------- ORDER SETTINGS ----------
        order_instruction = ""
        try:
            settings, created = AgentSettings.objects.get_or_create(user=agent_config.user)
    
            if settings.is_order_enable:
                try:
                    order_form = OrderForm.objects.get(user=agent_config.user)
                    link = f'https://newsmartagent.com/orders/{order_form.form_id}'
                    order_instruction = f"If user wants to buy/order, strictly give this link: {link}."
                except OrderForm.DoesNotExist:
                    order_instruction = "If they want to buy, say order form is not ready yet."
            else:
                order_instruction = "Online ordering is currently closed. Ask them to contact support for manual orders."
        except Exception as e:
            logger.error(f"Settings Error: {e}")
            order_instruction = "Handle orders politely."
        
    
         #<!----------------- 1. RAG logic start (Keyword filtering excluded) --------------!>
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
        
    
        page_access_token = agent_config.access_token
        # save user message
        # ---------- MEMORY ----------
        memory_context = ""
        memory_triggers = ['আমার', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']
        if any(word in text.lower() for word in memory_triggers):
            mem_data =  get_memory_context(agent_config, sender_id)
            if mem_data:
                memory_context = f"\nMem: {mem_data}"
                logger.info(f">>> Memory Loaded for Sender: {sender_id}")
    
    
        save_message(agent_config, sender_id, text, 'user')
    
        # get memory context
    
        prompt_parts = [agent_config.system_prompt + extra_instruction]
        if sheet_context:
            prompt_parts.append(sheet_context)
        if memory_context:
            prompt_parts.append(memory_context)
        full_prompt = "\n".join(prompt_parts)
        # get history
        history = get_last_message(agent_config, sender_id, limit=3)
    
        try:
        
            if user_profile.word_balance <=0:
            
                logger.info(f">>> User {user_profile.user.email} has 0 tokens. Aborting AI reply.")
                return

            
            #   <!---------------- AI reply -----------------!>

            ai_response = None
            model_choice = agent_config.ai_model.lower()
            try:

                if 'gpt' in model_choice:
                    logger.info("DEBUG FULL PROMPT:", full_prompt)
                    ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
                else:
                    ai_response = generate_reply(full_prompt, history, agent_config=agent_config)


            except Exception as e:
                logger.error(f"AI Generation Error: {e}")
   
            
            # --- DEBUG START ---
            logger.info(f"🔍 DEBUG: AI Raw Response Type: {type(ai_response)}")
            logger.info(f"🔍 DEBUG: AI Raw Response Content: {ai_response}")
            # --- DEBUG END ---
            

            # <!------------------- 1. Extracting data (Dictionary format handling) -------------------------!>
    
            if isinstance(ai_response, dict):
                reply = ai_response.get('reply', "System busy.")
                input_tokens = ai_response.get('input_tokens', 0)
                output_tokens = ai_response.get('output_tokens', 0)
                total_tokens = ai_response.get('total_tokens', 0)
    
                response_status = ai_response.get('status')
                reply = reply.replace('**', '').replace('*', '')
                # --- DEBUG START ---
    
                logger.info(f"🔍 DEBUG: Status from AI: '{response_status}'")
                logger.info(f"🔍 DEBUG: Reply Length: {len(reply)}")
    
           
                success = (response_status == 'success') or len(reply) > 5
                logger.info(f"🔍 DEBUG: Final Success Decision: {success}")
                # --- DEBUG END ---
    
                if not success:
                    error_info = ai_response.get('error_message') or f'AI status: {response_status}'
    
            else:
                # <!----------------------# If for some reason the old tuple format comes back (Fallback) ----------------------!>
                logger.error("⚠️ WARNING: AI Response is NOT a dictionary!")
                reply, total_tokens = ai_response if isinstance(ai_response, tuple) else (str(ai_response), 0)
                input_tokens = int(total_tokens * 0.5)
                output_tokens = total_tokens - input_tokens
                success = True
    
            try:
                #<! ----------------- Subtract spent tokens from profile --------------!>
                if success and total_tokens > 0:
                    user_profile.word_balance = F('word_balance') -  total_tokens
                    user_profile.save(update_fields=['word_balance'])
                    user_profile.refresh_from_db()
                    remaining_tokens = user_profile.word_balance
                    logger.info(f"Deducted {total_tokens} tokens. Remaining: {remaining_tokens}")
            except Exception as e:
                logger.error(f"Error deducting tokens: {e}")  
    
            #<!----------------- 2. Response time calculation -----------------!>
    
            duration = int((time.time() - start_time) * 1000)
    
            # <! ----------------3. Saving data in TokenUsageLog ----------------!>
    
            from aiAgent.models import TokenUsageLog
            TokenUsageLog.objects.create(
                user=agent_config.user,
                ai_agent=agent_config,
                sender_id=sender_id,
                platform=data.get('type', 'messenger'),
                model_name=model_choice,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                response_time=duration,
                success=success,
                error_message=error_info,
                request_type=request_type if request_type else 'chat'
            )
              # 4️⃣ Save in cache + rank
            if success:
                set_cached_reply(page_id, text, reply, model=model_choice)
                msg_hash = hashlib.md5(normalize_text(text).encode()).hexdigest()
                incr_message_frequency(page_id, msg_hash)
                logger.info(f"💾 New reply cached and ranked. Tokens used: {total_tokens}")
            
            # <! ------------- save AI message ----------!>
            save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens)
        except Exception as e:
            logger.error(f"AI Generation Error: {e}")
            reply = "I'm having some technical issues. Please wait a moment."
            total_tokens = 0
            
            from aiAgent.models import TokenUsageLog
            TokenUsageLog.objects.create(
                ai_agent = agent_config,
                sender_id = sender_id,
                success =False,
                error_message = str(e),
                model_name = model_choice
            )
    
        logger.info(f' Reply : {reply} | Tokens Used : {total_tokens}')
        logger.info(sender_id)
    
        logger.info(">>> Calling Extractor Now!")
        try:
            handle_smart_memory_update(agent_config, sender_id, text)
    
        except Exception as e:
            logger.error(f"Memory Handler Error: {e}")
    
    

        # n8n response webhook url
        N8N_RESPONSE_WEBHOOK = "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery"

        payload = {
            "sender_id": data.get('sender_id'),
            'reply': reply,
            'page_id': page_id,
            'page_access_token': page_access_token,
            'type': data.get('type'),
            'comment_id': data.get('comment_id'),
            'post_id': data.get('post_id')
        }


        logger.info(f'Page ID : {page_id}')

        try:
            response = requests.post(N8N_RESPONSE_WEBHOOK, json=payload, timeout=10)
            logger.info(f"Reply sent to n8n for {sender_id}")
            response.raise_for_status()
            logger.info("Successfully sent reply back to n8n")
                    # ---------- SAFE IDEMPOTENCY (AFTER SUCCESS) ----------

            if msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)

        except requests.exceptions.RequestException as e:
            logger.error("Webhook failed. Retrying...")
            raise self.retry(exc=e)

    except Exception as e:
        logger.error(f"Task Error: {e}")

    # Optionally retry here if it's a transient error
    finally:
        # --- STEP 1: Release Lock ---
        current_lock = r.get(lock_key)
        if current_lock and current_lock.decode() == lock_value:
            r.delete(lock_key)