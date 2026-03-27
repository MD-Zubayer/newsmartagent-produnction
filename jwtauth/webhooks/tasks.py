# webhooks/tasks.py

from celery import shared_task
import re, json, time, uuid, logging, hashlib, redis, requests
from datetime import timedelta
from aiAgent.models import AgentAI
from django.db.models import Q
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
    log_token_usage, deduct_user_tokens, deliver_whatsapp_reply, deliver_instagram_reply, deliver_facebook_reply, deliver_telegram_reply, handle_public_comment_logic,
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
from django.utils import timezone
from aiAgent.cache.client import get_redis_client

@after_setup_logger.connect
@after_setup_task_logger.connect
def setup_celery_logging(logger, **kwargs):
    logging.config.dictConfig(settings.LOGGING)

logger = logging.getLogger(__name__)

r = get_redis_client(db=0)


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

def send_cache_update_ws(user_id, agent_id, sender_id=None):
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

def _send_platform_buttons_alone(request_type, data, sender_id, page_id, effective_access_token, contact_obj):
    """Helper to send ONLY the buttons when the AI reply itself is skipped."""
    if not contact_obj:
        return
    try:
        if request_type == 'whatsapp':
            from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
            send_whatsapp_buttons(data, contact_obj)
        elif request_type == 'instagram':
            from aiAgent.business_logic.logic_handler import send_instagram_buttons
            send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj)
        elif request_type == 'telegram':
            from aiAgent.business_logic.logic_handler import send_telegram_buttons
            chat_id = data.get('chat_id') or sender_id
            send_telegram_buttons(chat_id, effective_access_token, contact_obj)
        elif request_type in ['messenger', 'facebook_comment']:
            from aiAgent.business_logic.logic_handler import send_messenger_buttons
            send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj)
    except Exception as e:
        logger.error(f"Failed to send standalone buttons: {e}")

def _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config):
    from aiAgent.models import Contact
    contact_obj = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
    
    if request_type == 'whatsapp':
        if contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
                delivered = send_whatsapp_buttons(data, contact_obj, reply_text=clean_reply)
                if delivered: return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_whatsapp_reply(data, clean_reply)
        if delivered and contact_obj:
            from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
            send_whatsapp_buttons(data, contact_obj)
        return delivered

    elif request_type == 'instagram':
        if contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_instagram_buttons
                delivered = send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered: return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_instagram_reply(data, clean_reply, page_id, effective_access_token)
        if delivered and contact_obj:
            from aiAgent.business_logic.logic_handler import send_instagram_buttons
            send_instagram_buttons(sender_id, page_id, effective_access_token, contact_obj)
        return delivered

    elif request_type == 'telegram':
        if contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_telegram_buttons
                delivered = send_telegram_buttons(data.get('chat_id') or sender_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered: return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_telegram_reply(data, clean_reply, effective_access_token)
        if delivered and contact_obj:
            from aiAgent.business_logic.logic_handler import send_telegram_buttons
            send_telegram_buttons(data.get('chat_id') or sender_id, effective_access_token, contact_obj)
        return delivered

    else:
        if contact_obj:
            try:
                from aiAgent.business_logic.logic_handler import send_messenger_buttons
                delivered = send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj, reply_text=clean_reply)
                if delivered: return True
            except Exception as e:
                logger.warning(f"Combined buttons failed: {e}")
        delivered = deliver_facebook_reply(data, clean_reply, page_id, effective_access_token)
        if delivered and contact_obj:
            from aiAgent.business_logic.logic_handler import send_messenger_buttons
            send_messenger_buttons(sender_id, page_id, effective_access_token, contact_obj)
        return delivered

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

    # 1. Platform Detection (Early)
    request_type = data.get('platform') or data.get('type') or 'messenger'
    logger.info(f"🔍 [Task] Raw data received (Platform: {request_type}): {data}")
    
    # Extract sender_id: from (WhatsApp JID), phone (WA), or sender_id (FB)
    sender_id = data.get('sender_id') or data.get('from') or data.get('phone')
    
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
    else:
        # messenger or whatsapp
        text = data.get('message') or data.get('text') or data.get('body')
    msg_id = data.get('message_id')
    incoming_ts = data.get('timestamp')

    if not all([sender_id, text, page_id]):
        logger.error(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}, page: {page_id}")
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
            return
        logger.info(f"✅ [Task] Agent found: ID {agent_config.id}, User {agent_config.user.email}")
        # Use matched agent page_id for downstream operations/cache keys
        if request_type == 'web_widget':
            page_id = f"widget_{agent_config.widget_key}"
        else:
            page_id = agent_config.page_id
            
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

        # --- ROBUST CONTACT SYNC & STATE MIGRATION ---
        p_type = request_type if request_type in ['whatsapp', 'messenger', 'web_widget', 'facebook_comment', 'instagram', 'telegram'] else 'messenger'
        
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

        # ── Message Logging & Dashboard Sync (Always) ──
        # Save early so even if AI doesn't reply (Human Mode), message is in history & dashboard
        save_message(agent_config, sender_id, text, 'user', platform=agent_config.platform)
        send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id)
        handle_smart_memory_update(agent_config, sender_id, text)
        
        # ── Auto-Reply Enable/Disable Check ──
        contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        if contact and (not contact.is_auto_reply_enabled or contact.is_human_needed):
            reason = "DISABLED" if not contact.is_auto_reply_enabled else "HUMAN_HANDOFF_ACTIVE"
            logger.info(f"🚫 Auto-reply is {reason} for contact {sender_id} (Agent: {agent_config.id}). Skipping AI response.")
            
            # Send buttons so user can easily restore AI
            _send_platform_buttons_alone(request_type, data, sender_id, page_id, effective_access_token, contact)
            
            if msg_id:
                r.set(f'processed_msg:{msg_id}', '1', ex=3600)
                r.delete(f'processing_msg:{msg_id}')
            if request_type == 'web_widget': return f"Auto-reply is currently {reason.lower()}."
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
        
        # --- Layer 1.5: Shared Agent Exact ---
        if not cached_res:
            shared_agents = agent_config.get_settings.shared_cache_agents.all()
            for shared_agent in shared_agents:
                # Correct identifier logic for shared agents (Web Widget support)
                shared_redis_id = f"widget_{shared_agent.widget_key}" if shared_agent.platform == 'web_widget' and shared_agent.widget_key else shared_agent.page_id
                
                potential_res = get_cached_reply(shared_redis_id, msg_text=text, track_hit=False)
                if potential_res:
                    msg_hash = potential_res.get('msg_hash')
                    if not msg_hash:
                        # Fallback for old cache entries
                        normalized = normalize_for_cache(text)
                        msg_hash = hashlib.md5(normalized.encode()).hexdigest()

                    # এক্সক্লুশন চেক (Redis Set)
                    exclusion_key = f"agent:{shared_redis_id}:sharing_exclusion_set"
                    r_db4 = get_redis_client(db=4)
                    if not r_db4.sismember(exclusion_key, msg_hash):
                        cached_res = potential_res
                        cache_hit_scope = "shared_agent_exact"
                        # Track this hit for the current agent's ranking
                        incr_message_frequency(page_id, msg_hash)
                        logger.info(f"🔗 SHARED CACHE HIT (Exact) from Agent {shared_agent.name} for '{text[:30]}'")
                        break

        # --- Layer 2: Agent Fuzzy ---
        if not cached_res:
            cached_res = fuzzy_match(page_id, text, threshold=80)
            if cached_res:
                cache_hit_scope = "agent_fuzzy"
            
            # --- Layer 2.5: Shared Agent Fuzzy ---
            if not cached_res:
                shared_agents = agent_config.get_settings.shared_cache_agents.all()
                for shared_agent in shared_agents:
                    shared_redis_id = f"widget_{shared_agent.widget_key}" if shared_agent.platform == 'web_widget' and shared_agent.widget_key else shared_agent.page_id
                    
                    potential_res = fuzzy_match(shared_redis_id, text, threshold=80, track_hit=False)
                    if potential_res:
                        msg_hash = potential_res.get('msg_hash')
                        if not msg_hash:
                            stored_text = potential_res.get('original_normalized') or text
                            msg_hash = hashlib.md5(stored_text.encode()).hexdigest()

                        # এক্সক্লুশন চেক
                        exclusion_key = f"agent:{shared_redis_id}:sharing_exclusion_set"
                        r_db4 = get_redis_client(db=4)
                        if not r_db4.sismember(exclusion_key, msg_hash):
                            cached_res = potential_res
                            cache_hit_scope = "shared_agent_fuzzy"
                            # Track this hit for the current agent too
                            incr_message_frequency(page_id, msg_hash)
                            logger.info(f"🔗 SHARED CACHE HIT (Fuzzy) from Agent {shared_agent.name} for '{text[:20]}'")
                            break

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
            from aiAgent.models import SmartKeyword
            from embedding.models import SpreadsheetKnowledge

            has_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user).exists()
            skip_margin = 6
            skip_embedding = False
            text_len = len(text)
            
            db_skip_keywords = SmartKeyword.objects.filter(category='embedding_skip').values_list('text', flat=True)
            for kw in db_skip_keywords:
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
            send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id)

            save_message(agent_config, sender_id, reply, 'assistant', tokens=0, platform=agent_config.platform)

            clean_reply = reply.strip()
            # Force platform-based routing: if agent is WhatsApp, send via WhatsApp delivery
            if agent_config.platform == 'whatsapp':
                request_type = 'whatsapp'

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
                delivered = _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config)

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
                if request_type == 'web_widget': return "Sorry, token limit reached for this agent."
                return

            order_instr = get_order_instructions(agent_config.user)
            sheet_ctx, extra_instr, query_vector = perform_rag_search(
                agent_config, text, post_context, order_instr, existing_vector=query_vector
            )
            system_instruction, history, current_msg = build_ai_context(agent_config, sender_id, text, extra_instr, sheet_ctx, platform=request_type)

            # ---- Cache Classification Instruction (JSON suffix) ----
            classify_instruction = (
                '\n\nReturn ONLY a valid JSON object: {"reply": "...", "cache_type": "...", "human_handoff": "..."}. '
                'Use "no_cache" for context-dependent words (it/this/that/ঐটা/সেটা) or very specific conversation flow.'
                'Use "sender_specific" for user-only info (my,amar,etc any language, name/order/status/আমি/আমার/ব্যক্তিগত তথ্য). '
                'Use "agent_specific" for information extracted from [KNOWLEDGE BASE DATA], business details like products/prices, or IF ASKED ABOUT YOUR IDENTITY (who you are, what you do). '
                'Use "global" ONLY for general world facts, universal greetings (Salam/Hi), or general knowledge. NEVER use "global" for identity, personal info, or specific business details.'
                '\nCRITICAL: If you cannot answer a question based on provided data, DO NOT trigger human handoff. Instead, politely ask clarifying questions to the user.'
                f'\nHowever, ONLY if the user EXPLICITLY and CLEARLY asks to talk to a human, admin, representative, or support team via text, you MUST set "human_handoff": true.'
                f'\nWARNING: Your identity/name is "{agent_config.name}". Do NOT trigger human_handoff just because the message contains your name, or words like "agent" or "support" without an explicit request to speak to a live person.'
                '\nSTRICT: No markdown blocks, no preamble, and ensure JSON syntax is perfect.'
            )
            system_instruction = system_instruction + classify_instruction

            # --- AI Call ---
            ai_data = get_ai_response(agent_config, system_instruction, history, current_msg)

            # ---- Parse JSON from AI reply ----
            raw_ai_reply = ai_data.get('reply', '')
            cache_type = 'agent_specific'  # ডিফাল্ট
            parsed_reply = raw_ai_reply    # ডিফাল্ট: raw reply
            json_parse_success = False
            is_handoff = False
            is_json_handoff_override = False

            json_match = re.search(r'\{.*\}', raw_ai_reply, re.DOTALL)
            if json_match:
                try:
                    parsed = json.loads(json_match.group())
                    extracted_reply = parsed.get('reply', '').strip()
                    if extracted_reply:  # শুধু non-empty reply গ্রহণ করা হবে
                        parsed_reply = extracted_reply
                        cache_type = parsed.get('cache_type', 'agent_specific').strip().lower()
                        json_parse_success = True
                        
                        # --- Human Handoff Check ---
                        raw_handoff = parsed.get('human_handoff')
                        if raw_handoff is True or str(raw_handoff).lower() == 'true':
                            # Safeguard: LLMs might hallucinate this flag if they see their own name containing trigger words.
                            # We dynamically check against the specific agent's name.
                            t_lower = text.lower().strip('?.,!/ "\'-_ \t')
                            agent_name = agent_config.name.lower().strip()
                            
                            # Ignore if the user just typed the bot's exact name
                            if t_lower == agent_name or t_lower.replace(" ", "") == agent_name.replace(" ", ""):
                                is_handoff = False
                                logger.warning(f"⚠️ Ignored hallucinated human_handoff=true for exact agent name match: {text}")
                            else:
                                is_handoff = True
                                is_json_handoff_override = True
                        
                        logger.info(f"📋 AI cache_type classified as: '{cache_type}' for '{text[:30]}'")
                    else:
                        logger.warning(f"⚠️ JSON parsed but reply field is empty. Using raw.")
                except (json.JSONDecodeError, AttributeError) as e:
                    logger.warning(f"⚠️ JSON parse failed from AI reply, using raw. Error: {e}")


            if is_handoff:
                # Override reply with friendly handoff message if it was a JSON-detected handoff
                if is_json_handoff_override:
                    parsed_reply = "অনুগ্রহ করে একটু অপেক্ষা করুন। আমাদের একজন human agent শীঘ্রই আপনার সাথে যোগাযোগ করবেন। 🙏"
                
                cache_type = 'no_cache'  # এই message কখনো cache হবে না
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
                        send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id) # Force sync
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
                    send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id)
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
                    send_cache_update_ws(agent_config.user.id, page_id, sender_id=sender_id)
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
                delivered = _deliver_reply_with_buttons(request_type, data, clean_reply, sender_id, page_id, effective_access_token, agent_config)

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
