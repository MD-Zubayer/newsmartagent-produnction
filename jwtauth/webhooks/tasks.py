# aiAgent/tasks.py

from celery import shared_task
import time, uuid, logging, hashlib, redis, requests
from aiAgent.models import AgentAI
from chat.services import save_message
from aiAgent.memory_handler import handle_smart_memory_update
from aiAgent.cache.hybrid_similarity import get_cached_reply, set_cached_reply, fuzzy_match
from aiAgent.cache.ranking import incr_message_frequency
from aiAgent.cache.metrics import incr_counter
from aiAgent.cache.cluster import get_cluster_map
from aiAgent.cache.utils import normalize_text
from chat.utils import get_smart_post_context

# আপনার logic_handler থেকে ফাংশনগুলো ইম্পোর্ট
from aiAgent.business_logic.logic_handler import (
    is_duplicate_or_outdated, acquire_user_lock, get_order_instructions,
    perform_rag_search, build_ai_context, get_ai_response,
    log_token_usage, deduct_user_tokens, deliver_reply_to_n8n, handle_public_comment_logic
)
from aiAgent.cache.redis_vector import (
    save_vector_embedding,
    search_similar_vectors
)

from aiAgent.business_logic import logic_handler

from celery.signals import after_setup_logger, after_setup_task_logger
import logging.config
from django.conf import settings

@after_setup_logger.connect
@after_setup_task_logger.connect
def setup_celery_logging(logger, **kwargs):
    # সেলেরিকে বাধ্য করা হচ্ছে Django-র LOGGING সেটিংস ব্যবহার করতে
    logging.config.dictConfig(settings.LOGGING)

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
def process_ai_reply_task(self, data):

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
  
    # ২. এজেন্ট ও প্রোফাইল লোড
    try:
        agent_config = AgentAI.objects.get(page_id=page_id, is_active=True)
        user_profile = agent_config.user.profile
    except Exception as e:
        logger.error(f'Error: Agent not found for page_id {page_id} - {e}')
        return
    # ৪. পাবলিক কমেন্ট হ্যান্ডলিং এবং লুপ প্রোটেকশন
    should_continue, reason = handle_public_comment_logic(data, agent_config, r)
    
    if not should_continue:
        logger.info(f"⏭️ Task stopped: {reason}")
        return # লুপ হলে এখানেই শেষ
    # ৩. ইডেমপোটেন্সি ও জম্বি চেক (Early Exit)
    if is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, r):
        return
        
        
    # ৪. redis lock
    _, lock_key, lock_value = acquire_user_lock(self, r, sender_id)

    try:
        # ৫. ইনিশিয়ালাইজেশন
        reply, success, total_tokens = "System busy.", False, 0
        ai_data = {'success': False, 'total_tokens': 0}

        # ৬. ক্যাশ চেক
        cached_res = None
        
        cached_res = get_cached_reply(page_id, msg_text=text)

        if not cached_res:
            cached_res = fuzzy_match(page_id, text, threshold=60)
        
        if not cached_res:
            cluster_map = get_cluster_map(page_id)
            normalized = normalize_text(text)
            msg_hash = hashlib.md5(normalized.encode()).hexdigest()

            cluster_id = cluster_map.get(msg_hash)

            if cluster_id:
                cached_res = get_cached_reply(page_id, msg_hash=cluster_id)
                if cached_res:
                    logger.info(f"🧬 CLUSTER MATCH FOUND for '{text[:30]}' -> Cluster: {cluster_id}")
                    print(f"🧬 CLUSTER MATCH FOUND for '{text[:30]}' -> Cluster: {cluster_id}")
            
        
        if cached_res:
            reply = cached_res.get('reply')
            success = True
            total_tokens = 0
        
            incr_counter(page_id, "cache_hit")
            logger.info(f"⚡ CACHE HIT → Skipping RAG + Embedding + AI for '{text[:30]}'")
        
            # Save messages
            save_message(agent_config, sender_id, text, 'user')
            save_message(agent_config, sender_id, reply, 'assistant', tokens=0)
        
            # Memory update optional (lightweight)
            handle_smart_memory_update(agent_config, sender_id, text)
        
            # Deliver immediately
            delivered = deliver_reply_to_n8n(
                data, reply, page_id, agent_config.access_token
            )
        
            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
        
            return   # 🔥🔥🔥 HARD STOP
        else:
            incr_counter(page_id, 'cache_miss')

            # ৭. জেনারেশন ফ্লো (ক্যাশ মিস হলে)
            if user_profile.word_balance <= 0:
                logger.info(f">>> User {user_profile.user.email} has 0 tokens. Aborting.")
                return
            
            # কন্টেন্ট তৈরি
            
            post_context = ""
            if request_type == 'facebook_comment':
                post_context = get_smart_post_context(data.get('post_id'), agent_config.access_token)
                
            order_instr = get_order_instructions(agent_config.user)
            sheet_ctx, extra_instr, query_vector = perform_rag_search(agent_config, text, post_context, order_instr )
            full_prompt, history = build_ai_context(agent_config, sender_id, text, extra_instr, sheet_ctx)
            
            # AI কল (আপনার সেই সলিড ডিকশনারি লজিক সহ)

            ai_data = get_ai_response(agent_config, full_prompt, history)
            reply, success, total_tokens = ai_data['reply'], ai_data['success'], ai_data['total_tokens']

            if success:
                deduct_user_tokens(user_profile, total_tokens)
                set_cached_reply(page_id, text, reply, model=agent_config.ai_model, input_tokens=ai_data.get('input_tokens', 0), output_tokens=ai_data.get('output_tokens', 0)) 
                
                try:                
                    from aiAgent.cache.cluster import assign_to_cluster  
                    from aiAgent.cache.hybrid_similarity import find_best_cached_hash
                            
                            
                    best_cluster_hash = find_best_cached_hash(page_id, text, threshold=70)
                                                      
                    target_hash = best_cluster_hash if best_cluster_hash else hashlib.md5(normalize_text(text).encode()).hexdigest()
                    
                    assign_to_cluster(page_id, text, target_hash)
                    logger.info(f"🧬 Message assigned to cluster: {text[:20]}")                
                    print(f"🧬 Message assigned to cluster: {text[:20]}")
                except Exception as e:                
                    logger.error(f"Failed to assign cluster: {e}")
                    print(f"Failed to assign cluster: {e}")

                if query_vector:
                    save_vector_embedding(page_id, text, query_vector)
                    logger.info(f"✅ Saved vector embedding for '{text[:30]}'")

            duration = int((time.time() - start_time) * 1000)
            log_token_usage(agent_config, sender_id, ai_data, duration, request_type)


            # ৯. লগিং ও ডাটাবেজ আপডেট
            duration = int((time.time() - start_time) * 1000)
            log_token_usage(agent_config, sender_id, ai_data, duration, request_type)

            save_message(agent_config, sender_id, text, 'user')
            save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens)

            # ১০. মেমোরি আপডেট
            handle_smart_memory_update(agent_config, sender_id, text)

            # ১১. এনএইটএন (n8n) ডেলিভারি
            
            delivered = deliver_reply_to_n8n(data, reply, page_id, agent_config.access_token)

            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
            logger.info(f"Successfully sent reply back to n8n for {sender_id}")

    except Exception as e:
        logger.error(f"Task Error: {e}")

    finally:
        # ১২. লক রিলিজ
        current_lock = r.get(lock_key)
        if current_lock and current_lock.decode() == lock_value:
            r.delete(lock_key)
            
            
            
