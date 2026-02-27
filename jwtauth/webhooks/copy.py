# from celery import shared_task
# import requests

# from aiAgent.models import AgentAI
# from chat.services import save_message, get_last_message
# from aiAgent.gemini import generate_reply
# from aiAgent.openai import generate_openai_reply
# from aiAgent.models import AgentAI, MissingRequirement
# from aiAgent.utils import get_memory_context
# from aiAgent.memory_service import extract_and_update_memory
# from aiAgent.memory_handler import handle_smart_memory_update
# from webhooks.constants import TARGET_KEYWORDS, embedding_skip_keyword
# from aiAgent.data_processor import processor_spreadsheet_data
# import json
# from django.http import JsonResponse
# from django.views.decorators.csrf import csrf_exempt
# import time
# from embedding.models import SpreadsheetKnowledge
# from pgvector.django import CosineDistance
# from embedding.utils import get_gemini_embedding
# from settings.models import AgentSettings
# from users.models import OrderForm
# import redis
# import signal
# import logging
# import uuid
# from django.db.models import F
# from webhooks.utils import fetch_facebook_post_text, get_message_cache, set_message_cache
# from chat.utils import get_smart_post_context

# logger = logging.getLogger(__name__)



# r = redis.Redis(host='newsmartagent-redis', port=6379, db=0)




# # -------------------- TASK -------------------- #
# @shared_task(
#              bind=True,
#              queue='chat_queue',
#              expires=180,
#              autoretry_for=(requests.exceptions.RequestException,),
#              retry_backoff=True,
#              max_retries=3,
#              time_limit=70,
#              soft_time_limit=60
#              )
# def process_ai_reply_task(self,data):

#     start_time = time.time()

#     sender_id = data.get('sender_id')
#     page_id = data.get('page_id')
#     request_type = data.get('type')
#     text = data.get('comment_text') if request_type == 'facebook_comment' else data.get('message')
#     msg_id = data.get('message_id')
#     incoming_ts = data.get('timestamp')

#     if not all([sender_id, text, page_id]):
#             logger.error(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}")
#             return
        
#     if msg_id and r.get(f'processed_msg:{msg_id}'):
#         logger.info(f"Duplicate message detected: {msg_id}")
#         return

#     lock_key = f"chat_lock:{sender_id}"
#     lock_value = str(uuid.uuid4())
#     lock = r.set(lock_key, lock_value, nx=True, ex=150)
#     if not lock:
#         logger.info(f"User {sender_id} busy. Retrying...")
#         raise self.retry(countdown=2)

#     try:   
#         try:
#             agent_config = AgentAI.objects.get(page_id=page_id, is_active=True)
#             user_profile = agent_config.user.profile
#         except Exception as e:
#             logger.error(f'Error: Agent not found for page_id {page_id} - {e}')
#             return

#         # --- [নতুন সংযোজন: ক্যাশ চেক] ---
#         cached_res = get_message_cache(page_id, text)
#         reply = None
#         success = False
#         total_tokens = 0
#         input_tokens = 0
#         output_tokens = 0
#         model_choice = agent_config.ai_model.lower()
#         error_info = ""

#         if cached_res:
#             reply = cached_res.get('reply')
#             model_choice = cached_res.get('model', model_choice)
#             success = True
#             logger.info(f"⚡ CACHE HIT: Using stored reply for '{text[:20]}'")
#         # -------------------------------

#         # যদি ক্যাশ না থাকে, তবেই আপনার আগের সব লজিক রান হবে
#         if not reply:
#             logger.info("📡 CACHE MISS: Starting full RAG and AI process...")
            
#             post_context_text = ""
#             if request_type == 'facebook_comment':
#                 post_id = data.get('post_id')
#                 post_context_text = get_smart_post_context(post_id, agent_config.access_token)
#                 if post_context_text:
#                     logger.info(f">>> FB Post Context Loaded: {post_context_text[:50]}...")

#             if incoming_ts:
#                 try:
#                     incoming_ts = float(incoming_ts)
#                 except (ValueError, TypeError):
#                     incoming_ts = None
#                 if incoming_ts and incoming_ts > 1e12:
#                     incoming_ts /= 1000

#                 latest = get_last_message(agent_config, sender_id, limit=1)
#                 if latest and latest[0].get('timestamp', 0) > incoming_ts:
#                     logger.info("🧟 Outdated task detected. Skipping.")
#                     return

#             # ---------- ORDER SETTINGS ----------
#             order_instruction = ""
#             try:
#                 settings, created = AgentSettings.objects.get_or_create(user=agent_config.user)
#                 if settings.is_order_enable:
#                     try:
#                         order_form = OrderForm.objects.get(user=agent_config.user)
#                         link = f'https://newsmartagent.com/orders/{order_form.form_id}'
#                         order_instruction = f"If user wants to buy/order, strictly give this link: {link}."
#                     except OrderForm.DoesNotExist:
#                         order_instruction = "If they want to buy, say order form is not ready yet."
#                 else:
#                     order_instruction = "Online ordering is currently closed. Ask them to contact support for manual orders."
#             except Exception as e:
#                 logger.error(f"Settings Error: {e}")
#                 order_instruction = "Handle orders politely."
            
#             # ---------- RAG LOGIC ----------
#             sheet_context = ""
#             extra_instruction = ""
#             rag_query = f"{post_context_text} {text}" if post_context_text else text
            
#             try:
#                 skip_margin = 15
#                 skip_embedding = False
#                 text_len = len(text)
#                 for kw in embedding_skip_keyword:
#                     if kw.lower() in text.lower() and abs(text_len - len(kw)) <= skip_margin:
#                         skip_embedding = True
#                         logger.info(f"Keyword '{kw}' found. Skipping embedding.")
#                         break

#                 query_vector = None
#                 if not skip_embedding:
#                     query_vector = get_gemini_embedding(rag_query)
#                     logger.info(f"DEBUG: Vector Generated: {True if query_vector else False}")
                
#                 if query_vector:
#                     related_docs = SpreadsheetKnowledge.objects.filter(user=agent_config.user).annotate(
#                         distance=CosineDistance('embedding', query_vector)
#                     ).order_by('distance')[:3]
        
#                     if related_docs:
#                         top_distance = related_docs[0].distance
#                         if top_distance < 0.45:
#                             matched_content = [doc.content for doc in related_docs]
#                             clean_data = "\n".join(matched_content)
#                             sheet_context = f"\n[DATA]:\n{clean_data}"
#                             post_info = f"User commented on this post: '{post_context_text}'. " if post_context_text else ""
#                             extra_instruction = f"""
#                                     {post_info} strictly using only the content inside [DATA].
#                                     Keep it short, clear, friendly, natural, conversational..
#                                     No markdown, no bold text, no formatting.
#                                     If appropriate, end with a short, warm follow-up question that encourages the user to continue.
#                                     {order_instruction}
#                                     """
#                             logger.info(f">>> Strong RAG Match! Distance: {top_distance}")
#                         elif top_distance < 0.65:
#                             matched_content = [doc.content for doc in related_docs]
#                             sheet_context = f"\n[DATA]:\n{'\n'.join(matched_content)}"
#                             extra_instruction = f"You may use [DATA] if relevant. If not, answer politely. {order_instruction}"
#                             logger.info(f">>> Weak RAG Match! Distance: {top_distance}")
#                         else:
#                             sheet_context = ""
#                             extra_instruction = f"Answer naturally using your knowledge. {order_instruction}"
#                             logger.info(f">>> No useful RAG match. Distance: {top_distance}")
#                     else:
#                         extra_instruction = f"Answer naturally using your knowledge. {order_instruction}"
#                 else:
#                     extra_instruction = f"Answer naturally using your knowledge. {order_instruction}"
#             except Exception as e:
#                 logger.error(f"RAG Search Error: {e}")
#                 extra_instruction = f" Answer politely. {order_instruction}"
            
#             # ---------- MEMORY & AI CALL ----------
#             memory_context = ""
#             memory_triggers = ['আমার', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']
#             if any(word in text.lower() for word in memory_triggers):
#                 mem_data = get_memory_context(agent_config, sender_id)
#                 if mem_data:
#                     memory_context = f"\nMem: {mem_data}"
#                     logger.info(f">>> Memory Loaded for Sender: {sender_id}")

#             save_message(agent_config, sender_id, text, 'user')
        
#             prompt_parts = [agent_config.system_prompt + extra_instruction]
#             if sheet_context: prompt_parts.append(sheet_context)
#             if memory_context: prompt_parts.append(memory_context)
#             full_prompt = "\n".join(prompt_parts)
#             history = get_last_message(agent_config, sender_id, limit=3)
        
#             try:
#                 if user_profile.word_balance <= 0:
#                     logger.info(f">>> User {user_profile.user.email} has 0 tokens. Aborting.")
#                     return

#                 ai_response = None
#                 if 'gpt' in model_choice:
#                     ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
#                 else:
#                     ai_response = generate_reply(full_prompt, history, agent_config=agent_config)

#                 if isinstance(ai_response, dict):
#                     reply = ai_response.get('reply', "System busy.").replace('**', '').replace('*', '')
#                     input_tokens = ai_response.get('input_tokens', 0)
#                     output_tokens = ai_response.get('output_tokens', 0)
#                     total_tokens = ai_response.get('total_tokens', 0)
#                     success = (ai_response.get('status') == 'success') or len(reply) > 5
#                     if not success: error_info = ai_response.get('error_message') or 'AI status failed'
#                 else:
#                     reply, total_tokens = ai_response if isinstance(ai_response, tuple) else (str(ai_response), 0)
#                     success = True

#                 # --- [নতুন সংযোজন: ক্যাশ সেভ] ---
#                 if success and reply and not any(word in text.lower() for word in memory_triggers):
#                     if not any(k in reply.lower() for k in ["busy", "technical issues", "wait a moment"]):
#                         set_message_cache(page_id, text, {'reply': reply, 'model': model_choice})
#                 # ------------------------------

#             except Exception as e:
#                 logger.error(f"AI Generation Error: {e}")
#                 reply = "I'm having some technical issues."

#         # ---------- COMMON LOGIC (Cache থাকুক বা না থাকুক) ----------
#         if reply:
#             # Token Deduction
#             try:
#                 if success and total_tokens > 0:
#                     user_profile.word_balance = F('word_balance') - total_tokens
#                     user_profile.save(update_fields=['word_balance'])
#             except Exception as e: logger.error(f"Error deducting tokens: {e}")

#             # Usage Logging
#             duration = int((time.time() - start_time) * 1000)
#             from aiAgent.models import TokenUsageLog
#             TokenUsageLog.objects.create(
#                 user=agent_config.user, ai_agent=agent_config, sender_id=sender_id,
#                 platform=data.get('type', 'messenger'), model_name=model_choice,
#                 input_tokens=input_tokens, output_tokens=output_tokens, total_tokens=total_tokens,
#                 response_time=duration, success=success, error_message=error_info,
#                 request_type=request_type if request_type else 'chat'
#             )

#             save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens)
            
#             try:
#                 handle_smart_memory_update(agent_config, sender_id, text)
#             except Exception as e: logger.error(f"Memory Handler Error: {e}")

#             # n8n Delivery
#             N8N_RESPONSE_WEBHOOK = "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery"
#             payload = {
#                 "sender_id": sender_id, 'reply': reply, 'page_id': page_id,
#                 'page_access_token': agent_config.access_token, 'type': data.get('type'),
#                 'comment_id': data.get('comment_id'), 'post_id': data.get('post_id')
#             }
#             try:
#                 response = requests.post(N8N_RESPONSE_WEBHOOK, json=payload, timeout=10)
#                 if response.status_code == 200 and msg_id:
#                     r.set(f'processed_msg:{msg_id}', '1', ex=3600)
#             except Exception as e:
#                 logger.error("Webhook failed. Retrying...")
#                 raise self.retry(exc=e)

#     except Exception as e:
#         logger.error(f"Task Error: {e}")
#     finally:
#         current_lock = r.get(lock_key)
#         if current_lock and current_lock.decode() == lock_value:
#             r.delete(lock_key)