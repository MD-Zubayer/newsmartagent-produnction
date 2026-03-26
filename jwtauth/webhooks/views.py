# webhooks/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from webhooks.tasks import process_ai_reply_task
import hashlib
import logging
import requests
from aiAgent.cache.client import get_redis_client

logger = logging.getLogger(__name__)

# ডুপ্লিকেট webhook hit ব্লক করার জন্য Redis client
_redis_client = None

def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = get_redis_client(db=0)
    return _redis_client

def _is_duplicate_webhook(sender_id, text, page_id):
    """
    একই sender_id + message + page_id এর জন্য 30 সেকেন্ডের মধ্যে
    দ্বিতীয় webhook hit হলে True রিটার্ন করবে।
    """
    try:
        r = _get_redis()
        # Hash: sender + message (first 100 chars) + page
        raw = f"{sender_id}:{str(text)[:100]}:{page_id}"
        hash_key = f"webhook_dedup:{hashlib.md5(raw.encode()).hexdigest()}"
        # nx=True: শুধু নতুন key set হবে, পুরনো থাকলে set হবে না
        is_new = r.set(hash_key, '1', nx=True, ex=30)
        return not is_new  # is_new=None মানে duplicate
    except Exception as e:
        logger.warning(f"⚠️ Webhook dedup Redis error: {e}")
        return False  # Redis error হলে proceed করতে দিন




@api_view(['POST', 'GET'])
@permission_classes([AllowAny])
def test_webhook(request):
    
    print('Incoming form n8n: ', request.data)

    return Response({'status': 'ok', 'message': 'django connected successfully'})



# recive data from n8n & return 202 ok

def handle_button_action(action, sender_id, page_id, platform):
    """
    Handle button clicks from users across all platforms.
    Returns True if an action was handled, False otherwise.
    """
    valid_actions = ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]
    if action not in valid_actions:
        return False
        
    from aiAgent.models import AgentAI, Contact
    
    try:
        # Find the agent
        agent = None
        if platform == 'telegram':
            from aiAgent.models import TelegramBotMapping, TelegramBot
            # Start by trying mapping
            mapping = TelegramBotMapping.objects.filter(chat_id=page_id, is_active=True).first()
            if mapping:
                agent = mapping.agent
            else:
                # Try TelegramBot
                tbot = TelegramBot.objects.filter(bot_username=page_id, is_active=True).first()
                if tbot:
                    agent = tbot.agent
                else:
                    # Legacy fallback
                    agent = AgentAI.objects.filter(page_id=page_id, platform='telegram', is_active=True).first()
        else:
            agent = AgentAI.objects.filter(page_id=page_id, platform=platform, is_active=True).first()
            
        if not agent:
            logger.warning(f"Button action {action} failed: Agent not found for page_id={page_id}, platform={platform}")
            return True # State it was handled (to stop further processing)
            
        # Get or create contact
        contact, _ = Contact.objects.get_or_create(
            identifier=sender_id,
            agent=agent,
            defaults={'platform': platform}
        )
        
        # Apply the action
        if action == "HUMAN_HELP":
            contact.is_human_needed = True
            contact.is_auto_reply_enabled = False
        elif action == "STOP_AI_REPLY":
            contact.is_auto_reply_enabled = False
        elif action == "ON_AI_REPLY":
            contact.is_auto_reply_enabled = True
        elif action == "RESOLVE_HUMAN":
            contact.is_human_needed = False
            contact.is_auto_reply_enabled = True
            
        contact.save()
        logger.info(f"✅ Handled button action {action} for contact {contact.id} ({sender_id})")
        
        # Send confirmation (optional, but good UX)
        from aiAgent.business_logic import logic_handler
        from users.models import FacebookPage
        
        # Send a brief confirmation message back to the user
        confirmation_text = {
            "HUMAN_HELP": "A human agent has been notified and will be with you shortly. AI replies are paused.",
            "STOP_AI_REPLY": "AI replies have been paused.",
            "ON_AI_REPLY": "AI replies have been resumed.",
            "RESOLVE_HUMAN": "Human mode resolved. AI replies have been resumed."
        }.get(action, "Action confirmed.")
        
        # Delivery logic
        if platform == 'whatsapp':
            data = {'sender_id': sender_id, 'delivery_jid': sender_id, 'sessionId': f"user_{agent.user.id}"}
            from aiAgent.business_logic.logic_handler import send_whatsapp_buttons
            send_whatsapp_buttons(data, contact, confirmation_text)
        elif platform == 'instagram':
            fb_page = FacebookPage.objects.filter(page_id=agent.page_id, is_active=True).first()
            token = fb_page.access_token if fb_page else agent.access_token
            from aiAgent.business_logic.logic_handler import send_instagram_buttons
            send_instagram_buttons(sender_id, page_id, token, contact, confirmation_text)
        elif platform == 'telegram':
            token = agent.access_token
            from aiAgent.business_logic.logic_handler import send_telegram_buttons
            send_telegram_buttons(page_id, token, contact, confirmation_text)
        elif platform == 'messenger':
            fb_page = FacebookPage.objects.filter(page_id=agent.page_id, is_active=True).first()
            token = fb_page.access_token if fb_page else agent.access_token
            from aiAgent.business_logic.logic_handler import send_messenger_buttons
            send_messenger_buttons(sender_id, page_id, token, contact, confirmation_text)
            
        # Remove buttons or send new ones (optional)
        
        return True
    except Exception as e:
        logger.error(f"Error handling button action {action}: {e}")
        return True # Handled (even if failed, we don't want AI to reply to a button payload)

@api_view(['POST'])
@permission_classes([AllowAny])
def ai_webhook(request):
    print("!!! REQUEST RECEIVED !!!")
    # Convert standard DRF request.data to a plain dict
    # Using .dict() if it's a QueryDict (form-data) to avoid list-values issue
    data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
    print("!!! DATA DICT !!!", data)
    # first validation
    logger.info(f"📥 [ai_webhook] Received raw data: {data}")
    
    sender_id = data.get('sender_id')
    page_id = data.get('page_id')
    
    # 1. Identify Request Type
    request_type = data.get('type') or data.get('platform')
    if not request_type:
        if data.get('receiver') or data.get('sessionId') or data.get('phone'):
            request_type = 'whatsapp'
        else:
            request_type = 'messenger'

    # 2. Extract Sender ID (The recipient of our future reply)
    # If it's WhatsApp, prioritize 'phone' or 'from' over a generic 'sender_id' if present
    sender_id = data.get('sender_id')
    if request_type == 'whatsapp':
        # WhatsApp specific: 'from' is often more accurate (contains @s.whatsapp.net)
        wa_sender = data.get('from') or data.get('phone')
        if wa_sender:
            # Ensure full JID (append domain if missing and looks like a phone number)
            wa_str = str(wa_sender)
            if '@' not in wa_str and wa_str.isdigit() and len(wa_str) > 7:
                sender_id = f"{wa_str}@s.whatsapp.net"
            else:
                sender_id = wa_str
    
    logger.info(f"🔍 [ai_webhook] Type: {request_type}, Extracted Sender: {sender_id}")

    # WhatsApp: normalize page_id to phone/session so agent lookup succeeds
    if request_type == 'whatsapp':
        cleaned_session = None
        if data.get('sessionId'):
            cleaned_session = str(data.get('sessionId')).replace('user_', '')
        
        # Expanded candidates for WhatsApp bot identification
        page_candidates = [
            data.get('page_id'),
            data.get('pageId'),    # camelCase fallback for some n8n nodes
            data.get('receiver'),
            data.get('to'),          # Common in Evolution API / Baileys
            data.get('phone'),
            data.get('sessionId'),
            cleaned_session,
        ]
        
        best_candidate = None
        for candidate in page_candidates:
            if not candidate:
                continue
            cand_str = str(candidate).strip()
            if cand_str.lower() in ['undefined', 'null', 'none', '']:
                continue
            
            if not best_candidate:
                best_candidate = cand_str
            
            # If current best is generic (user_X) but this one looks like a phone number (numeric), take it!
            if best_candidate.startswith('user_') and any(char.isdigit() for char in cand_str):
                 # Simple heuristic: if it has digits, it's probably a better ID than 'user_2'
                 best_candidate = cand_str
                 # If it starts with digits or 88, it's definitely a phone number, we can stop
                 if cand_str[0].isdigit():
                     break

        if best_candidate:
            page_id = best_candidate

    # comment or message

    if request_type == 'facebook_comment':
        text = data.get('comment_text')
    else:
        # messenger or whatsapp
        text = data.get('message')

    is_echo = data.get('is_echo', False)
    if isinstance(is_echo, str):
        is_echo = is_echo.lower() == 'true'

    if is_echo or not text:
        logger.info(f"⏭️ View Filter: Ignoring echo or missing text. sender={sender_id}, page={page_id}")
        return Response({'status': 'ignored'}, status=200)

    if not all([sender_id, page_id]):
        print(f"Missing data: sender={sender_id}, page={page_id}")
        return Response({'error': 'Missing data'}, status=400)

    # ======== Button Action Detection ========
    button_action = None
    
    # Messenger Quick Reply or Postback
    if request_type == 'messenger':
        # If payload was mapped to 'message' by n8n or exists directly
        payload = data.get('payload') 
        if not payload and text in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
            payload = text
        if payload in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
            button_action = payload
            
    # WhatsApp Button Response (from Baileys/Evolution API)
    elif request_type == 'whatsapp':
        # Depending on n8n mapping, the buttonId might be in a specific field
        button_id = data.get('buttonId') or data.get('listResponseId')
        # Sometimes the button text itself is the action if poorly mapped
        if not button_id and text in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
            button_id = text
            
        if button_id in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
            button_action = button_id
            
    if button_action:
        if handle_button_action(button_action, sender_id, page_id, request_type):
            return Response({'status': 'handled_button'}, status=200)

    if sender_id == page_id:
        print(f"⏭️ View Filter: Ignoring self-activity from {page_id}")
        return Response({'status': 'ignored'}, status=200)

    # 🔥 View-Level Deduplication: একই message 30s এর মধ্যে দ্বিতীয়বার এলে block করো
    if _is_duplicate_webhook(sender_id, text, page_id):
        logger.info(f"🔁 Duplicate webhook blocked for sender={sender_id}, text='{str(text)[:30]}'")
        return Response({'status': 'ignored', 'reason': 'duplicate'}, status=200)

    # send to celery

    
    try:
        # Ensure sender_id and page_id are in the payload sent to Celery
        data['sender_id'] = sender_id
        data['page_id'] = page_id
        data['type'] = request_type
        
        logger.info(f"📦 [ai_webhook] Sending to Celery: sender={sender_id}, page={page_id}, type={request_type}")
        process_ai_reply_task.delay(data)
        return Response({
             'status': 'accepted',
              'message': 'Task is processing in background'
            }, status=202)
    except Exception as e:
        # যদি রেডিস কানেকশন বা সিরিয়ালাইজেশন এরর হয়
        print(f"ERROR SENDING TO CELERY: {str(e)}")
        return Response({'error': 'Internal Task Queue Error'}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def instagram_webhook(request):
    """Dedicated webhook for Instagram messages from n8n"""
    data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
    logger.info(f"📥 [instagram_webhook] Received IG data: {data}")
    
    sender_id = str(data.get('sender_id') or data.get('senderId') or '')
    page_id = str(data.get('page_id') or data.get('recipient') or data.get('receiver') or data.get('recipient_id') or '')
    text = data.get('message') or data.get('text') or data.get('message_text')
    
    is_echo = data.get('is_echo', False)
    if isinstance(is_echo, str):
        is_echo = is_echo.lower() == 'true'

    if is_echo or not text:
        logger.info(f"⏭️ [instagram_webhook] View Filter: Ignoring echo or missing text. sender={sender_id}, page={page_id}")
        return Response({'status': 'ignored'}, status=200)

    if not all([sender_id, page_id]):
        logger.error(f"❌ [instagram_webhook] Missing core data: sender={sender_id}, page={page_id}")
        return Response({'error': 'Missing core data'}, status=400)

    if sender_id == page_id:
        logger.info(f"⏭️ [instagram_webhook] View Filter: Ignoring self-activity from {page_id}")
        return Response({'status': 'ignored'}, status=200)

    # ======== Button Action Detection ========
    button_action = None
    # Instagram quick replies usually come through as regular messages with a payload field
    # depending on your n8n setup, it might just be the text itself
    payload = data.get('payload') or data.get('quick_reply', {}).get('payload')
    if not payload and text in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
        payload = text
        
    if payload in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
        button_action = payload
        
    if button_action:
        if handle_button_action(button_action, sender_id, page_id, 'instagram'):
            return Response({'status': 'handled_button'}, status=200)

    # Dedup check
    if _is_duplicate_webhook(sender_id, text, page_id):
        logger.info(f"🔁 Duplicate Instagram webhook blocked for {sender_id}")
        return Response({'status': 'ignored', 'reason': 'duplicate'}, status=200)

    try:
        data['sender_id'] = sender_id
        data['page_id'] = page_id
        data['message'] = text
        data['type'] = 'instagram'
        data['platform'] = 'instagram'
        
        logger.info(f"📦 [instagram_webhook] Sending to Celery: sender={sender_id}, page={page_id}")
        process_ai_reply_task.delay(data)
        return Response({'status': 'accepted'}, status=202)
    except Exception as e:
        logger.error(f"❌ [instagram_webhook] Celery enqueue error: {e}")
        return Response({'error': 'Internal Task Queue Error'}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request):
    """Dedicated webhook for Telegram bot messages"""
    data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
    
    # 📢 Terminal Logging (User requested)
    print("\n" + "="*50)
    print("📥 [TELEGRAM WEBHOOK] Incoming Request")
    print("="*50)
    import json
    # Use indent=2 for readable terminal output
    try:
        print(json.dumps(data, indent=2))
    except:
        print(data)
    print("="*50 + "\n")

    logger.info(f"📥 [telegram_webhook] Received Telegram data: {data}")
    
    # Telegram webhook can have 'message' or 'callback_query'
    callback_query = data.get('callback_query')
    if not isinstance(callback_query, dict): callback_query = {}
    
    message = data.get('message')
    if not isinstance(message, dict): message = callback_query.get('message')
    if not isinstance(message, dict): message = {}
    
    # Robust extraction of identifiers
    raw_sender_id = callback_query.get('from', {}).get('id') or message.get('from', {}).get('id') or data.get('sender_id') or data.get('from_id')
    sender_id = str(raw_sender_id) if raw_sender_id else ''
    
    chat_id = str(message.get('chat', {}).get('id') or data.get('chat_id') or data.get('chatId') or '')
    text = callback_query.get('data') or message.get('text') or data.get('text') or data.get('message_text') or ''
    bot_username = data.get('bot_username') or data.get('botUsername') or ''
    if not bot_username:
        # Custom bots now append bot_username as a query param in the webhook URL
        bot_username = request.query_params.get('bot_username') if hasattr(request, 'query_params') else request.GET.get('bot_username', '')

    # NOTE: We no longer forward Telegram updates from Django to n8n here
    # to avoid routing loops. Flow should be: Telegram -> n8n (receiver) ->
    # Django -> n8n (sender) -> Telegram.

    # Check if this is a /start command with agent ID (shared bot)
    is_start_command = False
    agent_id = None
    if text.startswith('/start'):
        parts = text.split()
        if len(parts) > 1 and parts[1].startswith('agent_'):
            try:
                agent_id = int(parts[1].replace('agent_', ''))
                is_start_command = True
                logger.info(f"🚀 [telegram_webhook] Start command detected for agent {agent_id}")
                print(f"🚀 Start command for agent: {agent_id}")
            except ValueError:
                pass

    if not any([message, sender_id, chat_id]):
        print("⏭️ Ignoring empty payload")
        return Response({'status': 'ignored'}, status=200)
    
    if not all([sender_id, chat_id, text]):
        print(f"❌ Missing core data: sender={sender_id}, chat={chat_id}, text='{text[:20]}'")
        return Response({'error': 'Missing core data'}, status=400)

    # Resolve Agent (page_id)
    # If bot_username is provided, check if it's actually the user's username
    user_username = str(message.get('from', {}).get('username') or '')
    if bot_username and user_username and bot_username == user_username:
        print(f"⚠️ bot_username ({bot_username}) matches user's username. This is likely an n8n configuration error. Falling back to mapping.")
        bot_username = '' # Treat as missing to force mapping lookup

    from aiAgent.models import TelegramBotMapping, AgentAI, TelegramBot

    if is_start_command:
        # Handle shared bot start command
        try:
            agent = AgentAI.objects.get(id=agent_id, is_active=True)
            mapping, created = TelegramBotMapping.objects.get_or_create(
                chat_id=chat_id,
                defaults={'agent': agent, 'user': agent.user, 'is_active': True}
            )
            if not created:
                mapping.agent = agent
                mapping.user = agent.user
                mapping.is_active = True
                mapping.save()
            print(f"✅ Mapping updated: {chat_id} -> {agent.name}")
            page_id = f"shared_agent_{agent.id}"
            bot_username = 'shared_bot'
        except AgentAI.DoesNotExist:
            print(f"❌ Agent {agent_id} not found")
            return Response({'status': 'ignored', 'reason': 'agent_not_found'}, status=200)
    
    elif not bot_username:
        # No bot_username provided, must check mapping
        try:
            mapping = TelegramBotMapping.objects.get(chat_id=chat_id, is_active=True)
            agent = mapping.agent
            page_id = f"shared_agent_{agent.id}"
            print(f"🔍 Mapping found for chat {chat_id} -> {agent.name}")
        except TelegramBotMapping.DoesNotExist:
            print(f"⏭️ No mapping found for chat {chat_id} and no bot_username provided.")
            return Response({'status': 'ignored', 'reason': 'no_mapping'}, status=200)
    else:
        # Custom bot - verify if agent exists with this bot_username (check TelegramBot model first)
        tbot = TelegramBot.objects.filter(bot_username=bot_username, is_active=True).first()
        if tbot:
            agent = tbot.agent
            page_id = bot_username
            print(f"✅ Agent found via TelegramBot model: @{bot_username} -> {agent.name}")
        else:
            # Fallback to legacy AgentAI.page_id check
            agent = AgentAI.objects.filter(page_id=bot_username, platform='telegram', is_active=True).first()
            if agent:
                page_id = bot_username
                print(f"🔍 Agent found via legacy page_id lookup: @{bot_username} -> {agent.name}")
            else:
                print(f"⚠️ No agent found with bot_username: {bot_username}. Checking mapping as fallback.")
                try:
                    mapping = TelegramBotMapping.objects.get(chat_id=chat_id, is_active=True)
                    agent = mapping.agent
                    page_id = f"shared_agent_{agent.id}"
                    print(f"🔍 System found a mapping fallback for {chat_id} -> {agent.name}")
                except TelegramBotMapping.DoesNotExist:
                    print(f"❌ No agent found for bot_username '{bot_username}' and no mapping fallback exists.")
                    return Response({'status': 'error', 'reason': 'agent_not_found'}, status=404)

    # Ignore self-messages
    if str(sender_id) == str(chat_id) and text.strip().lower() == 'ping':
        # Special case for self-ping testing
        pass
        
    # ======== Button Action Detection ========
    button_action = None
    # Telegram inline keyboard callbacks come via 'callback_query'
    callback_query = data.get('callback_query', {})
    if callback_query:
        # Override sender and text with callback data
        sender_id = str(callback_query.get('from', {}).get('id', sender_id))
        callback_data = callback_query.get('data')
        if callback_data in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
            button_action = callback_data
            # We don't need text for button actions, but want to record deduplication
            text = callback_data
            
    # Also allow standard text to act as button if poorly formatted
    if not button_action and text in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN"]:
        button_action = text
        
    if button_action:
        # We need to acknowledge Telegram callback queries otherwise they spin
        try:
            import requests, os
            bot_token = agent.access_token if agent else None
            callback_id = callback_query.get('id')
            if bot_token and callback_id:
                requests.post(f"https://api.telegram.org/bot{bot_token}/answerCallbackQuery", json={"callback_query_id": callback_id})
        except Exception:
            pass # Failsafe
            
        if handle_button_action(button_action, sender_id, page_id, 'telegram'):
            return Response({'status': 'handled_button'}, status=200)
    
    # Dedup check
    if _is_duplicate_webhook(sender_id, text, page_id):
        print(f"🔁 Duplicate blocked for {sender_id}")
        return Response({'status': 'ignored', 'reason': 'duplicate'}, status=200)

    try:
        data['sender_id'] = sender_id
        data['page_id'] = page_id
        data['message'] = text
        data['type'] = 'telegram'
        data['platform'] = 'telegram'
        data['chat_id'] = chat_id
        
        print(f"📦 Message accepted. Routing to AI. sender={sender_id}, page={page_id}")
        process_ai_reply_task.delay(data)
        return Response({'status': 'accepted'}, status=202)
    except Exception as e:
        print(f"❌ Celery error: {e}")
        return Response({'error': str(e)}, status=500)
