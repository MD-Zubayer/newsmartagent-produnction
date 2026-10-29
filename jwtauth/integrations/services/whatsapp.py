import requests
import os
import logging
from django.conf import settings

logger = logging.getLogger('aiAgent')
from jwtauth.provider_metrics import provider_call

class WhatsAppService:
    @staticmethod
    def get_api_url():
        return getattr(settings, 'BAILEYS_API_URL', 'http://baileys:3001')

    @staticmethod
    def get_api_secret():
        return getattr(settings, 'BAILEYS_API_SECRET', 'nsa-baileys-secret-2024')

    @classmethod
    def send_message(cls, session_id, to, message_text, msg_type='text', media_url=None, buttons=None, list_message=None):
        """
        Directly send WhatsApp message via Baileys API
        """
        url = f"{cls.get_api_url()}/send-message"
        headers = {
            'x-api-secret': cls.get_api_secret(),
            'Content-Type': 'application/json'
        }
        
        payload = {
            'sessionId': session_id,
            'to': to,
            'message': message_text,
            'type': msg_type,
        }
        if media_url:
            payload['media_url'] = media_url
        if buttons:
            payload['buttons'] = buttons
        if list_message:
            payload['listMessage'] = list_message

        try:
            logger.info(f"[WhatsAppService] Sending directly to {to} | Session: {session_id} | Type: {msg_type}")
            with provider_call("whatsapp_baileys", "send_message"):
                response = requests.post(url, json=payload, headers=headers, timeout=35)
            if response.status_code in [200, 201]:
                logger.info(f"[WhatsAppService] Direct send OK: {response.json()}")
                return True
            logger.error(f"[WhatsAppService] Direct send error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[WhatsAppService] Direct send exception: {e}")
            return False

    @classmethod
    def send_base64_image(cls, session_id, to, image_base64, caption="Invoice"):
        """
        Directly send Base64 encoded image (invoice)
        """
        url = f"{cls.get_api_url()}/send-message-base64"
        headers = {
            'x-api-secret': cls.get_api_secret(),
            'Content-Type': 'application/json'
        }
        payload = {
            'sessionId': session_id,
            'to': to,
            'image_base64': image_base64,
            'caption': caption
        }

        try:
            logger.info(f"[WhatsAppService] Sending base64 image directly to {to}")
            with provider_call("whatsapp_baileys", "send_image"):
                response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.status_code in [200, 201]:
                return True
            logger.error(f"[WhatsAppService] Direct base64 send error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[WhatsAppService] Direct base64 send exception: {e}")
            return False
