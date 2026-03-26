# webhooks/views.py

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from webhooks.tasks import process_ai_reply_task
import hashlib
import logging
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
    
    # Telegram webhook structure: message.from.id, message.chat.id, message.text
    message = data.get('message', {})
    
    # Robust extraction
    sender_id = str(message.get('from', {}).get('id') or data.get('sender_id') or data.get('from_id') or '')
    chat_id = str(message.get('chat', {}).get('id') or data.get('chat_id') or data.get('chatId') or '')
    text = message.get('text') or data.get('text') or data.get('message_text') or ''
    bot_username = data.get('bot_username') or data.get('botUsername') or ''
    if not bot_username:
        # Custom bots now append bot_username as a query param in the webhook URL
        bot_username = request.query_params.get('bot_username') if hasattr(request, 'query_params') else request.GET.get('bot_username', '')

    # Forward raw update to n8n (optional ingress workflow)
    try:
        import os
        n8n_ingress_url = os.getenv("TELEGRAM_WEBHOOK_URL") or os.getenv("N8N_TELEGRAM_WEBHOOK_URL")
        if n8n_ingress_url:
            requests.post(n8n_ingress_url, json=data, timeout=5)
    except Exception as e:
        logger.warning(f"n8n ingress forward failed: {e}")

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
