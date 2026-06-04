import base64
import logging
from typing import Any, Dict, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)


def _resolve_whatsapp_session_id(agent_config: Optional[Any]) -> str:
    """Resolve a WhatsApp session id for Baileys delivery."""
    if agent_config is not None:
        user = getattr(agent_config, 'user', None)
        if user is not None and getattr(user, 'id', None) is not None:
            return f"user_{user.id}"

    # fallback to explicit env value if provided
    session_id = getattr(settings, 'BAILEYS_SESSION_ID', None) or None
    if session_id and session_id != 'default':
        return session_id
    return 'default'


def send_whatsapp_message(
    recipient_id: str,
    message_type: str,
    image_url: Optional[str] = None,
    caption: Optional[str] = None,
    text: Optional[str] = None,
    agent_config: Optional[Any] = None,
) -> Dict[str, Any]:
    """Send a WhatsApp message/image through Baileys."""
    baileys_url = getattr(settings, 'BAILEYS_API_URL', None) or 'http://baileys:3001'
    secret = getattr(settings, 'BAILEYS_API_SECRET', None) or ''
    session_id = _resolve_whatsapp_session_id(agent_config)
    recipient = str(recipient_id).strip()

    if not recipient:
        return {'status': 'error', 'error': 'Recipient ID is required'}

    if message_type == 'image':
        if not image_url:
            return {'status': 'error', 'error': 'Image URL is required for WhatsApp image messages'}

        payload = {
            'sessionId': session_id,
            'to': recipient,
            'type': 'image',
            'message': caption or '',
            'media_url': image_url,
        }
        endpoint = f"{baileys_url}/send-message"
    else:
        payload = {
            'sessionId': session_id,
            'to': recipient,
            'type': 'text',
            'message': text or caption or '',
        }
        endpoint = f"{baileys_url}/send-message"

    headers = {
        'Content-Type': 'application/json',
        'x-api-secret': secret,
    }

    try:
        logger.info(
            f"[WhatsApp] Sending {message_type} to {recipient} via Baileys session={session_id}"
        )
        response = requests.post(endpoint, json=payload, headers=headers, timeout=30)
        if response.status_code not in (200, 202, 204):
            error_text = response.text or 'Unknown error'
            logger.error(
                f"[WhatsApp] Baileys send failed: status={response.status_code}, error={error_text}"
            )
            return {
                'status': 'error',
                'error': f'Baileys send failed: {response.status_code}',
                'details': error_text,
            }

        try:
            data = response.json()
        except ValueError:
            data = {'status': 'success'}

        return {
            'status': 'success',
            'platform': 'whatsapp',
            'recipient_id': recipient,
            'message_type': message_type,
            'payload': payload,
            'response': data,
        }

    except requests.exceptions.RequestException as exc:
        logger.error(f"[WhatsApp] Baileys request exception: {exc}")
        return {
            'status': 'error',
            'error': 'Baileys request failed',
            'details': str(exc),
        }
