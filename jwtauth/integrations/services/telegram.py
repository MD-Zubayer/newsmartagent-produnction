import requests
import logging

logger = logging.getLogger('aiAgent')

class TelegramService:
    @staticmethod
    def send_message(token, chat_id, message_text, reply_markup=None, msg_type='text', media_url=None):
        """
        Send message directly via Telegram Bot API (Supports Text, Voice, Photo, Video, and Document)
        """
        if msg_type in ['voice', 'audio'] and media_url:
            url = f"https://api.telegram.org/bot{token}/sendVoice"
            payload = {"chat_id": chat_id, "voice": media_url}
        elif msg_type == 'image' and media_url:
            url = f"https://api.telegram.org/bot{token}/sendPhoto"
            payload = {"chat_id": chat_id, "photo": media_url, "caption": message_text}
        elif msg_type == 'video' and media_url:
            url = f"https://api.telegram.org/bot{token}/sendVideo"
            payload = {"chat_id": chat_id, "video": media_url, "caption": message_text}
        elif msg_type == 'document' and media_url:
            url = f"https://api.telegram.org/bot{token}/sendDocument"
            payload = {"chat_id": chat_id, "document": media_url, "caption": message_text}
        else:
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {"chat_id": chat_id, "text": message_text}

        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            logger.info(f"[TelegramService] Direct send to chat: {chat_id} | Type: {msg_type}")
            response = requests.post(url, json=payload, timeout=15)
            if response.status_code == 200:
                return True
            logger.error(f"[TelegramService] Error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[TelegramService] Exception: {e}")
            return False

    @staticmethod
    def send_voice(token, chat_id, media_url):
        """
        Send voice note directly via Telegram Bot API
        """
        return TelegramService.send_message(token, chat_id, "", msg_type='voice', media_url=media_url)
