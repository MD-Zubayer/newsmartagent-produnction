from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.http import HttpResponse
from django.conf import settings
import logging
import time
from webhooks.tasks import process_ai_reply_task
from webhooks.views import (
    _is_duplicate_webhook,
    handle_button_action,
    _map_whatsapp_numeric_button_to_action,
    _should_treat_numeric_as_order_text
)

logger = logging.getLogger('aiAgent')

# Strict restriction: only text, image, and voice/audio are allowed to reach the AI.
ALLOWED_MESSAGE_TYPES = ['text', 'image', 'voice', 'audio']

def _get_fallback_session_id(platform, page_id):
    """Resolve session_id dynamically based on page_id and platform"""
    try:
        from aiAgent.models import AgentAI
        agent = AgentAI.objects.filter(page_id=page_id, platform=platform, is_active=True).first()
        if agent:
            return f"user_{agent.user.id}"
    except Exception:
        pass
    return ""

def _format_image_system_note(message_text):
    """Consistent formatting for user uploaded image matching n8n rules"""
    caption_or_msg = (message_text or "").strip()
    if caption_or_msg:
        return caption_or_msg + " (System Note: The user uploaded an image. Our image-search engine matched this image with the product in the KNOWLEDGE BASE DATA below. Treat that product as the core topic of this image.)"
    else:
        return "[Image received] (System Note: The user uploaded an image. Our image-search engine matched this image with the product in the KNOWLEDGE BASE DATA below. Treat that product as the core topic of this image.)"

@api_view(['POST'])
@permission_classes([AllowAny])
def whatsapp_incoming(request):
    """
    Direct endpoint for incoming Baileys messages, bypassing n8n
    """
    data = request.data.dict() if hasattr(request.data, 'dict') else dict(request.data)
    raw_sender = data.get('from') or data.get('phone') or data.get('sender_id') or ""
    sender_text = str(raw_sender).strip().lower()
    if sender_text.endswith('@newsletter') or sender_text.endswith('@broadcast'):
        logger.info("⏭️ [Direct integrations] Ignored WhatsApp channel/broadcast message sender=%s", sender_text)
        return Response({'status': 'ignored', 'reason': 'channel_message'}, status=200)

    logger.info(f"📥 [Direct integrations] WhatsApp Raw Data: {data}")
    
    message_type = data.get('message_type') or 'text'
    if message_type not in ALLOWED_MESSAGE_TYPES:
        logger.info(f"⏭️ [WhatsApp Incoming] Discarded unsupported message type: {message_type}")
        return Response({'status': 'ignored', 'reason': 'unsupported_message_type'}, status=200)

    sender_id = str(raw_sender)
    if sender_id and '@' not in sender_id and sender_id.isdigit() and len(sender_id) > 7:
        sender_id = f"{sender_id}@s.whatsapp.net"

    raw_receiver = data.get('receiver') or data.get('to') or data.get('phone') or ""
    session_id = data.get('sessionId') or data.get('session_id') or ""
    
    # page_id resolves to receiver || sessionId || ""
    page_id = raw_receiver or session_id or ""
    if page_id and not isinstance(page_id, str):
        page_id = str(page_id)
        
    if not session_id:
        session_id = _get_fallback_session_id('whatsapp', page_id)
        
    caption = data.get('caption') or ''
    message = data.get('message') or ''
    text = data.get('text') or ''

    # Replicate exact n8n message formatting logic
    if message_type == "image":
        formatted_message = _format_image_system_note(caption or message)
    else:
        formatted_message = caption or message or text or ""

    button_id = data.get('buttonId') or data.get('listResponseId') or ""
    
    # Check button commands/action
    if button_id and str(button_id).strip().isdigit():
        from aiAgent.models import Contact, AgentAI
        agent = AgentAI.objects.filter(page_id=page_id, platform='whatsapp', is_active=True).first()
        contact = Contact.objects.filter(identifier=sender_id, agent=agent).first() if agent else None
        mapped_action = _map_whatsapp_numeric_button_to_action(agent, contact, button_id)
        if mapped_action:
            button_id = mapped_action

    if button_id in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN", "CONFIRM_ORDER", "EDIT_ORDER", "CANCEL_ORDER"]:
        if handle_button_action(button_id, sender_id, page_id, 'whatsapp'):
            return Response({'status': 'handled_button'}, status=200)

    # Dedup
    if _is_duplicate_webhook(sender_id, formatted_message, page_id):
        return Response({'status': 'ignored', 'reason': 'duplicate'}, status=200)

    # Construct the exact n8n-matching schema payload
    timestamp = data.get('timestamp') or int(time.time() * 1000)
    mimetype = data.get('mimetype') or ""
    media_url = data.get('mediaUrl') or data.get('media_url') or ""
    push_name = data.get('pushName') or data.get('push_name') or ""

    payload = {
        "sender_id": sender_id,
        "message": formatted_message,
        "buttonId": button_id,
        "push_name": push_name,
        "page_id": page_id,
        "sessionId": session_id,
        "platform": "whatsapp",
        "type": "whatsapp",
        "timestamp": timestamp,
        "message_type": message_type,
        "mimetype": mimetype,
        "mediaUrl": media_url,
        "image_base64": data.get('image_base64'),
        "video_base64": data.get('video_base64'),
        "audio_base64": data.get('audio_base64'),
        "document_base64": data.get('document_base64'),
        "fileName": data.get('fileName')
    }
    
    process_ai_reply_task.delay(payload)
    return Response({'status': 'accepted'}, status=202)


@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def meta_incoming(request):
    """
    Direct Meta Webhook receiver for Messenger and Instagram messages / comments
    """
    if request.method == 'GET':
        # Meta verify hook challenge
        verify_token = request.GET.get('hub.verify_token')
        challenge = request.GET.get('hub.challenge')
        meta_verify_token = getattr(settings, 'META_VERIFY_TOKEN', 'nsa-meta-verify-2024')
        if verify_token == meta_verify_token:
            return HttpResponse(challenge)
        return HttpResponse('Forbidden', status=403)

    # POST - Webhook events
    data = request.data
    logger.info(f"📥 [Direct integrations] Meta Webhook Incoming: {data}")
    
    # Meta webhook format parses entries
    entries = data.get('entry', [])
    for entry in entries:
        platform_type = 'messenger' if 'messaging' in entry else 'instagram'
        
        # Messenger / Instagram Direct Message events
        messaging_events = entry.get('messaging', [])
        for event in messaging_events:
            sender_id = str(event.get('sender', {}).get('id', ''))
            recipient_id = str(event.get('recipient', {}).get('id', ''))
            message = event.get('message', {})
            postback = event.get('postback', {})
            
            # Skip echoes
            if message.get('is_echo'):
                continue
                
            text = message.get('text') or ''
            postback_payload = postback.get('payload', '') if isinstance(postback, dict) else ''
            postback_title = postback.get('title', '') if isinstance(postback, dict) else ''
            
            # Handle button actions for postback
            if postback_payload in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN", "CONFIRM_ORDER", "EDIT_ORDER", "CANCEL_ORDER"]:
                if handle_button_action(postback_payload, sender_id, recipient_id, platform_type):
                    continue

            product_id_inquiry = None
            if postback_payload and postback_payload.startswith("DETAILS:"):
                parts = postback_payload.split(":", 2)
                product_id_inquiry = parts[1] if len(parts) > 1 and parts[1] != '0' else None
                prod_name = parts[2] if len(parts) > 2 else ""
                text = f"{prod_name} সম্পর্কে বিস্তারিত বিবরণ ও মূল্য জানতে চাই" if prod_name else (postback_title or "এই পণ্যটির বিস্তারিত জানতে চাই")
            elif not text and postback_payload:
                text = postback_title or postback_payload

            message_type = 'text'
            media_url = ''
            mimetype = ''
            
            # Handle attachments (image, audio, video, etc)
            attachments = message.get('attachments', [])
            if attachments:
                att_type = attachments[0].get('type')
                message_type = att_type if att_type else 'text'
                media_url = attachments[0].get('payload', {}).get('url') or ''

            # Restrict message types
            if message_type not in ALLOWED_MESSAGE_TYPES:
                logger.info(f"⏭️ [Meta Incoming] Discarded unsupported message type: {message_type}")
                continue

            # Image caption custom note mapping
            if message_type == 'image':
                formatted_message = _format_image_system_note(text)
            else:
                formatted_message = text
                
            timestamp = event.get('timestamp') or int(time.time() * 1000)
            msg_mid = str(message.get('mid') or postback.get('mid') or '')

            # Format payload for Django AI flow
            payload = {
                "sender_id": sender_id,
                "message": formatted_message,
                "message_id": msg_mid,
                "buttonId": "",
                "push_name": "",
                "page_id": recipient_id,
                "sessionId": "",
                "platform": platform_type,
                "type": platform_type,
                "timestamp": timestamp,
                "message_type": message_type,
                "mimetype": mimetype,
                "mediaUrl": media_url,
                "payload": postback_payload,
            }
            if product_id_inquiry:
                payload["product_id"] = product_id_inquiry
            
            # Handle quick reply button payload
            quick_reply = message.get('quick_reply', {})
            btn_payload = quick_reply.get('payload')
            if btn_payload in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN", "CONFIRM_ORDER", "EDIT_ORDER", "CANCEL_ORDER"]:
                if handle_button_action(btn_payload, sender_id, recipient_id, platform_type):
                    continue

            process_ai_reply_task.delay(payload)

        # Facebook Page / Instagram public comments
        changes = entry.get('changes', [])
        for change in changes:
            field = change.get('field')
            value = change.get('value', {}) or {}
            page_id = str(entry.get('id', ''))

            comment_payload = None
            if field == 'feed':
                # Facebook Page feed: only newly added comments / replies
                if value.get('verb') == 'add' and value.get('item') in ['comment', 'reply']:
                    from_id = str(value.get('from', {}).get('id', ''))
                    comment_payload = {
                        "sender_id": from_id,
                        "message": value.get('message') or '',
                        "push_name": value.get('from', {}).get('name', ''),
                        "comment_id": str(value.get('comment_id', '')),
                        "parent_id": str(value.get('parent_id', '')) if value.get('parent_id') else None,
                        "post_id": str(value.get('post_id', '')) if value.get('post_id') else None,
                        "platform": 'facebook_comment',
                    }
            elif field == 'comments':
                # Instagram comments webhook
                from_id = str(value.get('from', {}).get('id', ''))
                comment_payload = {
                    "sender_id": from_id,
                    "message": value.get('text') or value.get('message') or '',
                    "push_name": value.get('from', {}).get('username', '') or value.get('from', {}).get('name', ''),
                    "comment_id": str(value.get('id') or value.get('comment_id') or ''),
                    "parent_id": str(value.get('parent_id', '')) if value.get('parent_id') else None,
                    "post_id": str((value.get('media') or {}).get('id', '')) or None,
                    "platform": 'instagram_comment',
                }

            if not comment_payload or not comment_payload["comment_id"]:
                continue

            # Prevent replying to the page's own comments
            if comment_payload["sender_id"] == page_id:
                continue

            platform_cmt = comment_payload["platform"]
            session_id = _get_fallback_session_id(platform_cmt, page_id)
            timestamp = value.get('created_time', int(time.time()))
            try:
                timestamp = int(timestamp) * 1000
            except (TypeError, ValueError):
                timestamp = int(time.time()) * 1000

            payload = {
                "sender_id": comment_payload["sender_id"],
                "message": comment_payload["message"],
                "buttonId": "",
                "push_name": comment_payload["push_name"],
                "page_id": page_id,
                "sessionId": session_id,
                "platform": platform_cmt,
                "type": platform_cmt,
                "timestamp": timestamp,
                "message_type": "text",
                "mimetype": "",
                "mediaUrl": "",
                "comment_id": comment_payload["comment_id"],
                "parent_id": comment_payload["parent_id"],
                "post_id": comment_payload["post_id"],
            }

            # New comment automation pipeline (seller-configured). Falls back to legacy
            # behaviour (Facebook only) when the seller has not configured comment settings.
            try:
                from settings.comment_automation import maybe_dispatch
                handled = maybe_dispatch(payload)
            except Exception as dispatch_err:
                logger.error(f"[Comment] automation dispatch error: {dispatch_err}")
                handled = False

            if not handled and platform_cmt == 'facebook_comment':
                process_ai_reply_task.delay(payload)

    return Response({'status': 'ok'}, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_incoming(request):
    """
    Direct Telegram Bot update receiver
    """
    data = request.data
    logger.info(f"📥 [Direct integrations] Telegram Incoming: {data}")
    
    # callback inline buttons or standard message
    callback_query = data.get('callback_query')
    message = callback_query.get('message') if callback_query else data.get('message', {})
    
    if not message:
        return Response({'status': 'ignored'}, status=200)
        
    chat_id = str(message.get('chat', {}).get('id', ''))
    sender_user = callback_query.get('from', {}) if callback_query else message.get('from', {})
    sender_id = str(sender_user.get('id', ''))
    text = callback_query.get('data') if callback_query else message.get('text', '')
    
    bot_username = request.query_params.get('bot_username', 'shared_bot')
    
    # Determine message/media type
    message_type = 'text'
    media_url = ''
    mimetype = ''
    
    if 'photo' in message:
        message_type = 'image'
        text = message.get('caption') or ''
        photos = message.get('photo', [])
        if photos:
            media_url = f"telegram_file_id:{photos[-1].get('file_id')}"
    elif 'voice' in message:
        message_type = 'voice'
        media_url = f"telegram_file_id:{message.get('voice', {}).get('file_id')}"
        mimetype = message.get('voice', {}).get('mime_type', '')
    elif 'audio' in message:
        message_type = 'audio'
        media_url = f"telegram_file_id:{message.get('audio', {}).get('file_id')}"
        mimetype = message.get('audio', {}).get('mime_type', '')
    elif 'document' in message:
        message_type = 'document'
        media_url = f"telegram_file_id:{message.get('document', {}).get('file_id')}"
        mimetype = message.get('document', {}).get('mime_type', '')

    # Restrict message types
    if message_type not in ALLOWED_MESSAGE_TYPES:
        logger.info(f"⏭️ [Telegram Incoming] Discarded unsupported message type: {message_type}")
        return Response({'status': 'ignored', 'reason': 'unsupported_message_type'}, status=200)

    if message_type == 'image':
        formatted_message = _format_image_system_note(text)
    else:
        formatted_message = text or ''

    session_id = _get_fallback_session_id('telegram', bot_username)
    timestamp = message.get('date', int(time.time())) * 1000
    push_name = f"{sender_user.get('first_name', '')} {sender_user.get('last_name', '')}".strip()

    payload = {
        "sender_id": sender_id,
        "message": formatted_message,
        "buttonId": text if text in ["HUMAN_HELP", "STOP_AI_REPLY", "ON_AI_REPLY", "RESOLVE_HUMAN", "CONFIRM_ORDER", "EDIT_ORDER", "CANCEL_ORDER"] else "",
        "push_name": push_name,
        "page_id": bot_username,
        "chat_id": chat_id,
        "sessionId": session_id,
        "platform": "telegram",
        "type": "telegram",
        "timestamp": timestamp,
        "message_type": message_type,
        "mimetype": mimetype,
        "mediaUrl": media_url,
        "callback_query": callback_query
    }
    
    # Handle button actions
    btn_id = payload["buttonId"]
    if btn_id:
        if handle_button_action(btn_id, sender_id, bot_username, 'telegram'):
            return Response({'status': 'handled_button'}, status=200)

    process_ai_reply_task.delay(payload)
    return Response({'status': 'accepted'}, status=202)


@api_view(['POST'])
@permission_classes([AllowAny])
def tiktok_incoming(request):
    """
    Direct TikTok Webhook receiver
    """
    data = request.data
    logger.info(f"📥 [Direct integrations] TikTok webhook raw payload: {data}")
    event = data.get('event')
    if event == 'im.message.receive':
        content = data.get('content', {})
        open_id = str(content.get('open_id', ''))
        message_text = content.get('message', {}).get('text', '')
        
        session_id = _get_fallback_session_id('tiktok', 'tiktok_shop')
        timestamp = data.get('event_time', int(time.time())) * 1000
        
        payload = {
            "sender_id": open_id,
            "message": message_text,
            "buttonId": "",
            "push_name": "",
            "page_id": "tiktok_shop",
            "sessionId": session_id,
            "platform": "tiktok",
            "type": "tiktok",
            "timestamp": timestamp,
            "message_type": "text",
            "mimetype": "",
            "mediaUrl": ""
        }
        process_ai_reply_task.delay(payload)
        
    return Response({'status': 'ok'}, status=200)


@api_view(['POST'])
@permission_classes([AllowAny])
def youtube_incoming(request):
    """
    Direct YouTube Webhook receiver (pub/sub or push notifications)
    """
    data = request.data
    logger.info(f"📥 [Direct integrations] YouTube webhook raw payload: {data}")
    feed = data.get('feed', {})
    entry = feed.get('entry', {})
    if entry:
        comment_id = str(entry.get('id', ''))
        comment_text = entry.get('content') or entry.get('title') or ''
        author_id = str(entry.get('author', {}).get('uri', ''))
        author_name = entry.get('author', {}).get('name', '')
        
        session_id = _get_fallback_session_id('youtube', 'youtube_channel')
        timestamp = int(time.time() * 1000)
        
        payload = {
            "sender_id": author_id,
            "message": comment_text,
            "buttonId": "",
            "push_name": author_name,
            "page_id": "youtube_channel",
            "sessionId": session_id,
            "platform": "youtube",
            "type": "youtube",
            "timestamp": timestamp,
            "message_type": "text",
            "mimetype": "",
            "mediaUrl": "",
            "comment_id": comment_id
        }
        process_ai_reply_task.delay(payload)
        
    return Response({'status': 'ok'}, status=200)
