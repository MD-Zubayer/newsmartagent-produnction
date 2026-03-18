# webhooks/tasks.py

from celery import shared_task
import re, json, time, uuid, logging, hashlib, redis, requests
from aiAgent.models import AgentAI
from chat.services import save_message
from aiAgent.memory_handler import handle_smart_memory_update
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
    log_token_usage, deduct_user_tokens, deliver_whatsapp_reply, deliver_facebook_reply, handle_public_comment_logic,
    check_token_availability, deliver_dashboard_reply
)
from webhooks.utils import fetch_messenger_profile
from aiAgent.cache.redis_vector import (
    save_vector_embedding,
    search_similar_vectors
)

from aiAgent.business_logic import logic_handler

from celery.signals import after_setup_logger, after_setup_task_logger
import logging.config
from django.conf import settings
from aiAgent.cache.client import get_redis_client

@after_setup_logger.connect
@after_setup_task_logger.connect
def setup_celery_logging(logger, **kwargs):
    logging.config.dictConfig(settings.LOGGING)

logger = logging.getLogger(__name__)

r = get_redis_client(db=0)

def send_cache_update_ws(user_id, agent_id):
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
                    "agent_id": agent_id,
                }
            }
        )
    except Exception as e:
        logger.error(f"WebSocket broadcast error: {e}")

def deliver_dashboard_reply(user_id, reply, msg_id):
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from aiAgent.models import DashboardAILog
        
        # ১. লগ আপডেট করুন
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
             expires=180,
             autoretry_for=(requests.exceptions.RequestException,),
             retry_backoff=True,
             max_retries=5,
             retry_jitter=True,
             time_limit=140,
             soft_time_limit=130
             )
def process_ai_reply_task(self, data):

    start_time = time.time()

    # Extract sender_id: from (WhatsApp JID), phone (WA), or sender_id (FB)
    logger.info(f"🔍 [Task] Raw data received: {data}")
    sender_id = data.get('sender_id') or data.get('from') or data.get('phone')
    if sender_id and isinstance(sender_id, str) and '@' in sender_id:
        if '@lid' in sender_id:
            # Preserve LID
            pass
        else:
            sender_id = sender_id.split('@')[0]
    data['sender_id'] = sender_id  # Ensure it's available for delivery functions
    logger.info(f"🔍 [Task] Extracted sender_id: {sender_id}")
    page_id = data.get('page_id')
    request_type = data.get('type') or data.get('platform')
    if not request_type:
        if data.get('receiver') or data.get('sessionId') or data.get('phone'):
            request_type = 'whatsapp'
        else:
            request_type = 'messenger'

    # WhatsApp: normalize page_id to phone/session for lookup
    if request_type == 'whatsapp':
        cleaned_session = None
        if data.get('sessionId'):
            cleaned_session = str(data.get('sessionId')).replace('user_', '')
        page_candidates = [
            data.get('receiver'),
            data.get('phone'),
            data.get('from'),
            data.get('sessionId'),
            cleaned_session,
            page_id,
        ]
        for candidate in page_candidates:
            if candidate:
                page_id = candidate
                break

    if request_type == 'facebook_comment':
        text = data.get('comment_text')
    else:
        # messenger or whatsapp
        text = data.get('message')
    msg_id = data.get('message_id')
    incoming_ts = data.get('timestamp')

    if not all([sender_id, text, page_id]):
        logger.error(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}")
        return

    # ২. এজেন্ট ও প্রোফাইল লোড
    try:
        if request_type == 'whatsapp':
            # Priority: Bot's phone number, excluding sender or generic session strings
            candidates = [
                data.get('receiver'),
                data.get('phone'), # but careful if this is sender phone
            ]
            lookup_ids = [str(c).split('@')[0] for c in candidates if c and '@' in str(c)]
            # Also add raw receiver if digit-only or valid phone format
            for c in candidates:
                val = str(c) if c else ""
                if val.isdigit() and len(val) > 7:
                    lookup_ids.append(val)
        else:
            lookup_ids = [str(page_id)]

        lookup_ids = list(set([i for i in lookup_ids if i]))

        agent_config = AgentAI.objects.filter(
            is_active=True,
            page_id__in=lookup_ids
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
            return
        logger.info(f"✅ [Task] Agent found: ID {agent_config.id}, page_id {agent_config.page_id}, User {agent_config.user.email}")
        # Use matched agent page_id for downstream operations/cache keys
        page_id = agent_config.page_id
        user_profile = agent_config.user.profile

        from users.models import FacebookPage
        fb_page = FacebookPage.objects.filter(page_id=page_id, is_active=True).first()
        effective_access_token = fb_page.access_token if fb_page else agent_config.access_token

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

        Contact.objects.update_or_create(
            agent=agent_config,
            identifier=sender_id,
            platform=request_type if request_type in ['whatsapp', 'messenger'] else 'messenger',
            defaults={
                'name': contact_name if contact_name else None,
                'push_name': incoming_push_name if incoming_push_name else None
            }
        )

        # ── Auto-Reply Enable/Disable Check ──
        contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        if contact and not contact.is_auto_reply_enabled:
            logger.info(f"🚫 Auto-reply is DISABLED for contact {sender_id} (Agent: {agent_config.id}). Skipping AI response.")
            if msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')
            return
    except Exception as e:
        logger.error(f'Error: Agent not found for page_id {page_id} - {e}')
        return

    # ৩. পাবলিক কমেন্ট হ্যান্ডলিং এবং লুপ প্রোটেকশন
    should_continue, reason = handle_public_comment_logic(data, agent_config, r)
    if not should_continue:
        logger.info(f"⏭️ Task stopped: {reason}")
        return

    # ৪. ইডেমপোটেন্সি ও জম্বি চেক (Early Exit)
    if is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, r):
        return

    # ৫. Redis lock
    _, lock_key, lock_value = acquire_user_lock(self, r, sender_id)

    try:
        # ৬. ইনিশিয়ালাইজেশন
        reply, success, total_tokens = "System busy.", False, 0
        ai_data = {'success': False, 'total_tokens': 0}
        query_vector = None

        post_context = ""
        if request_type == 'facebook_comment':
            post_context = get_smart_post_context(data.get('post_id'), effective_access_token)

        # ========================================================
        # ৭. ক্যাশ চেক — 7-Layer Grouped Lookup
        #
        #   1. Global Exact    ──→ Hit? → Reply পাঠাও
        #   2. Global Fuzzy    ──→ Hit? → Reply পাঠাও
        #   3. Agent Exact     ──→ Hit? → Reply পাঠাও
        #   4. Agent Fuzzy     ──→ Hit? → Reply পাঠাও
        #   5. Sender Exact    ──→ Hit? → Reply পাঠাও
        #   6. Cluster Hit     ──→ Hit? → Reply পাঠাও
        #   7. Vector Hit      ──→ Hit? → Reply পাঠাও
        #   8. AI Call         ──→ শুধু তখনই
        # ========================================================

        cached_res = None
        cache_hit_scope = None  # কোন layer থেকে hit এলো সেটা track করার জন্য

        # --- Layer 1: Agent Exact ---
        cached_res = get_cached_reply(page_id, msg_text=text)
        if cached_res:
            cache_hit_scope = "agent_exact"

        # --- Layer 2: Agent Fuzzy ---
        if not cached_res:
            cached_res = fuzzy_match(page_id, text, threshold=80)
            if cached_res:
                cache_hit_scope = "agent_fuzzy"

        # --- Layer 3: Global Exact ---
        if not cached_res:
            cached_res = get_global_cached_reply(page_id, text)
            if cached_res:
                cache_hit_scope = "global_exact"

        # --- Layer 4: Global Fuzzy ---
        if not cached_res:
            cached_res = global_fuzzy_match(page_id, text, threshold=92)
            if cached_res:
                cache_hit_scope = "global_fuzzy"

        # --- Layer 5: Sender Exact ---
        if not cached_res:
            cached_res = get_sender_cached_reply(page_id, sender_id, text)
            if cached_res:
                cache_hit_scope = "sender_exact"

        # --- Layer 6: Cluster Match ---
        if not cached_res:
            cluster_map = get_cluster_map(page_id)
            normalized = normalize_for_cache(text)
            msg_hash = hashlib.md5(normalized.encode()).hexdigest()
            cluster_id = cluster_map.get(msg_hash)
            if cluster_id:
                cached_res = get_cached_reply(page_id, msg_hash=cluster_id)
                if cached_res:
                    cache_hit_scope = "cluster"
                    logger.info(f"🧬 CLUSTER MATCH FOUND for '{text[:30]}' -> Cluster: {cluster_id}")

        # --- Layer 7: Vector Similarity ---
        if not cached_res:
            from webhooks.constants import embedding_skip_keyword
            from embedding.models import SpreadsheetKnowledge

            has_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user).exists()
            skip_margin = 10
            skip_embedding = False
            text_len = len(text)
            for kw in embedding_skip_keyword:
                if kw.lower() in text.lower() and abs(text_len - len(kw)) <= skip_margin:
                    skip_embedding = True
                    break

            if has_knowledge and not skip_embedding and len(text) > 3:
                from embedding.utils import get_gemini_embedding
                rag_query = f"{post_context} {text}" if (request_type == 'facebook_comment' and post_context) else text
                query_vector = get_gemini_embedding(rag_query)

                if query_vector:
                    vector_hits = search_similar_vectors(page_id, query_vector, top_k=1)
                    if vector_hits and vector_hits[0]['score'] < 0.12:
                        similar_text = vector_hits[0]['text']
                        cached_res = get_cached_reply(page_id, msg_text=similar_text)
                        if cached_res:
                            cache_hit_scope = "vector"
                            logger.info(f"🔮 VECTOR CACHE HIT! '{text[:20]}' matched with '{similar_text[:20]}'")
            else:
                logger.info(f"⏭️ Skipping Gemini Embedding for User {agent_config.user.email} (No knowledge or skip kw)")

        # ========================================================
        # ৮. Cache Hit হলে → সরাসরি reply পাঠাও
        # ========================================================
        if cached_res:
            reply = cached_res.get('reply')
            success = True
            total_tokens = 0

            incr_counter(page_id, "cache_hit")
            logger.info(f"⚡ CACHE HIT [{cache_hit_scope}] → '{text[:30]}'")
            send_cache_update_ws(agent_config.user.id, page_id)

            save_message(agent_config, sender_id, text, 'user', platform=agent_config.platform)
            save_message(agent_config, sender_id, reply, 'assistant', tokens=0, platform=agent_config.platform)
            handle_smart_memory_update(agent_config, sender_id, text)

            clean_reply = reply.strip()
            # Force platform-based routing: if agent is WhatsApp, send via WhatsApp delivery
            if agent_config.platform == 'whatsapp':
                request_type = 'whatsapp'

            # Force platform-based routing: if agent is WhatsApp, send via WhatsApp delivery
            if agent_config.platform == 'whatsapp':
                request_type = 'whatsapp'

            if request_type == 'dashboard':
                delivered = deliver_dashboard_reply(agent_config.user.id, clean_reply, msg_id)
            elif request_type == 'whatsapp':
                delivered = deliver_whatsapp_reply(data, clean_reply)
            else:
                delivered = deliver_facebook_reply(data, clean_reply, page_id, effective_access_token)

            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')

            # ── Update WhatsApp Log (Cache Hit) ──
            if wa_msg_obj:
                wa_msg_obj.ai_reply = reply
                wa_msg_obj.save()

            return  # 🔥 HARD STOP — AI call skip

        # ========================================================
        # ৯. Cache Miss → AI call + Grouped Cache Save
        # ========================================================
        else:
            incr_counter(page_id, 'cache_miss')

            effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

            if not check_token_availability(user_profile, effective_model):
                logger.info(f">>> User {user_profile.user.email} has no tokens for model {effective_model}. Aborting.")
                return

            order_instr = get_order_instructions(agent_config.user)
            sheet_ctx, extra_instr, query_vector = perform_rag_search(
                agent_config, text, post_context, order_instr, existing_vector=query_vector
            )
            full_prompt, history = build_ai_context(agent_config, sender_id, text, extra_instr, sheet_ctx, platform=request_type)

            # ---- Cache Classification Instruction (JSON suffix) ----
            # logic_handler.py-তে কোনো পরিবর্তন নেই। Prompt suffix এখানেই যোগ হয়।
            classify_instruction = (
                'Return ONLY a valid JSON object: {"reply": "...", "cache_type": "..."}. '
                'Use "no_cache" for context-dependent words (it/this/that/ঐটা/সেটা) or very specific conversation flow. '
                'Use "sender_specific" for user-only info (my,amar,etc any language, name/order/status/আমি/আমার/ব্যক্তিগত তথ্য). '
                'Use "agent_specific" ONLY for information extracted from [KNOWLEDGE BASE DATA] or business-specific details like specific products/prices. '
                'Use "global" for general knowledge, universal greetings (Salam/Hi), and any answer based on your pre-trained general intelligence rather than the provided knowledge base.'
                'STRICT: No markdown blocks, no preamble, and ensure JSON syntax is perfect.'
            )
            full_prompt = full_prompt + classify_instruction

            # --- AI Call ---
            ai_data = get_ai_response(agent_config, full_prompt, history)

            # ---- Parse JSON from AI reply ----
            raw_ai_reply = ai_data.get('reply', '')
            cache_type = 'agent_specific'  # ডিফাল্ট
            parsed_reply = raw_ai_reply    # ডিফাল্ট: raw reply
            json_parse_success = False

            json_match = re.search(r'\{.*\}', raw_ai_reply, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                    extracted_reply = parsed.get('reply', '').strip()
                    if extracted_reply:  # শুধু non-empty reply গ্রহণ করা হবে
                        parsed_reply = extracted_reply
                        cache_type = parsed.get('cache_type', 'agent_specific').strip().lower()
                        json_parse_success = True
                        logger.info(f"📋 AI cache_type classified as: '{cache_type}' for '{text[:30]}'")
                    else:
                        logger.warning(f"⚠️ JSON parsed but reply field is empty. Using raw.")
                except (json.JSONDecodeError, AttributeError) as e:
                    logger.warning(f"⚠️ JSON parse failed from AI reply, using raw. Error: {e}")

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

            # Update ai_data with the cleaned reply
            ai_data['reply'] = parsed_reply
            reply, success, total_tokens = ai_data['reply'], ai_data['success'], ai_data['total_tokens']


            if success:
                effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

                deduct_user_tokens(user_profile, total_tokens, effective_model)

                # ---- 3-Tier Grouped Cache Save ----
                if cache_type == 'global':
                    set_global_cached_reply(
                        text, reply, model=effective_model,
                        input_tokens=ai_data.get('input_tokens', 0),
                        output_tokens=ai_data.get('output_tokens', 0),
                    )
                    send_cache_update_ws(agent_config.user.id, page_id)
                elif cache_type == 'sender_specific':
                    set_sender_cached_reply(
                        page_id, sender_id, text, reply, model=effective_model,
                        input_tokens=ai_data.get('input_tokens', 0),
                        output_tokens=ai_data.get('output_tokens', 0),
                    )
                elif cache_type == 'agent_specific':
                    # বিদ্যমান agent-level cache (DB 2)
                    set_cached_reply(
                        page_id, text, reply, model=effective_model,
                        input_tokens=ai_data.get('input_tokens', 0),
                        output_tokens=ai_data.get('output_tokens', 0),
                        is_special=agent_config.is_special_agent
                    )
                    send_cache_update_ws(agent_config.user.id, page_id)
                else:
                    # no_cache বা অজানা type → save করা হবে না
                    logger.info(f"🚫 Cache SKIPPED (no_cache) for: '{text[:30]}'")

                # ---- Clustering (unchanged) ----
                try:
                    from aiAgent.cache.cluster import assign_to_cluster
                    from aiAgent.cache.hybrid_similarity import find_best_cached_hash
                    best_cluster_hash = find_best_cached_hash(page_id, text, threshold=70)
                    target_hash = best_cluster_hash if best_cluster_hash else hashlib.md5(normalize_for_cache(text).encode()).hexdigest()
                    assign_to_cluster(page_id, text, target_hash)
                except Exception as e:
                    logger.error(f"Failed to assign cluster: {e}")

                # ---- Vector Embedding Save (unchanged) ----
                if query_vector:
                    msg_hash_for_vector = hashlib.md5(normalize_for_cache(text).encode()).hexdigest()
                    save_vector_embedding(page_id, text, msg_hash_for_vector, query_vector)
                    logger.info(f"✅ Saved vector embedding for '{text[:30]}'")

                save_message(agent_config, sender_id, text, 'user', platform=agent_config.platform)
                save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens, platform=agent_config.platform)
                handle_smart_memory_update(agent_config, sender_id, text)

                # ── Update WhatsApp Log (AI Call) ──
                if wa_msg_obj:
                    wa_msg_obj.ai_reply = reply
                    wa_msg_obj.save()

            duration = int((time.time() - start_time) * 1000)
            log_token_usage(agent_config, sender_id, ai_data, duration, request_type)
            clean_reply = reply.strip()
            
            if request_type == 'dashboard':
                delivered = deliver_dashboard_reply(agent_config.user.id, clean_reply, msg_id)
            elif request_type == 'whatsapp':
                delivered = deliver_whatsapp_reply(data, clean_reply)
            else:
                delivered = deliver_facebook_reply(data, clean_reply, page_id, effective_access_token)

            if delivered and msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')

            logger.info(f"Final reply processed for {sender_id}. Success: {success}")

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
