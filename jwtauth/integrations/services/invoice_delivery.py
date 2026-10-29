"""
Invoice Delivery Service — Direct Platform Delivery (n8n ছাড়া)

n8n এর পরিবর্তে সরাসরি platform API ব্যবহার করে invoice image পাঠায়:
  - WhatsApp   → Baileys /send-message-base64
  - Messenger  → Meta Graph API (multipart upload)
  - Instagram  → Meta Graph API (multipart upload)
  - Telegram   → Telegram Bot API sendPhoto
"""

import io
import base64
import logging
import os
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class InvoiceDeliveryService:
    """
    n8n-মুক্ত invoice delivery।
    AgentAI / TelegramBot model থেকে credentials নিয়ে সরাসরি platform-এ পাঠায়।
    """

    # ─── Public entry point ──────────────────────────────────────────────────

    @classmethod
    def send(
        cls,
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str = "📋 Here's your invoice",
    ) -> bool:
        """
        Invoice image পাঠায় সংশ্লিষ্ট platform-এ।

        Args:
            platform: 'whatsapp' | 'messenger' | 'instagram' | 'telegram' | 'facebook_comment'
            sender_id: Customer-এর platform-specific ID
            image_base64: Invoice image (base64 string)
            order_data: Order details dict
            message: Caption / message text

        Returns:
            True on success, False on failure.
            'session_not_connected' (str) যদি WhatsApp session না থাকে।
        """
        platform = (platform or "").lower()

        if platform == "whatsapp":
            return cls._send_whatsapp(sender_id, image_base64, order_data, message)

        if platform in ("messenger", "instagram"):
            return cls._send_meta(platform, sender_id, image_base64, order_data, message)

        if platform == "telegram":
            return cls._send_telegram(sender_id, image_base64, order_data, message)

        # facebook_comment বা অন্য platform — image delivery supported নয়
        logger.warning(f"⚠️ [InvoiceDelivery] Platform '{platform}' does not support invoice image delivery. Skipping.")
        return False

    # ─── WhatsApp via Baileys ─────────────────────────────────────────────────

    @classmethod
    def _send_whatsapp(
        cls,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str,
    ):
        """Baileys /send-message-base64 endpoint-এ invoice image পাঠায়."""
        try:
            baileys_url = os.environ.get("BAILEYS_API_URL") or "http://baileys:3001"
            baileys_secret = os.environ.get("BAILEYS_API_SECRET", "nsa-baileys-secret-2024")
            env_session = os.environ.get("BAILEYS_SESSION_ID")

            user_id = order_data.get("user_id") if order_data else None
            if env_session and env_session != "default":
                session_id = env_session
            else:
                session_id = f"user_{user_id}" if user_id else "default"

            # Normalize phone number/JID
            if "@" in sender_id:
                to_jid = sender_id.strip()
                phone_log = to_jid
            else:
                phone = sender_id.strip().lstrip("+")
                if phone.startswith("0"):
                    phone = "88" + phone[1:]
                to_jid = phone
                phone_log = phone

            payload = {
                "sessionId": session_id,
                "to": to_jid,
                "image_base64": image_base64,
                "caption": message,
                "metadata": {
                    "order_id": order_data.get("id") if order_data else None,
                    "user_id": user_id,
                },
            }

            logger.info(f"📱 [InvoiceDelivery] WhatsApp → Baileys | to={phone_log} session={session_id}")
            response = requests.post(
                f"{baileys_url}/send-message-base64",
                json=payload,
                headers={"Content-Type": "application/json", "X-API-Secret": baileys_secret},
                timeout=30,
            )

            if response.status_code in (200, 202, 204):
                logger.info("✅ [InvoiceDelivery] WhatsApp invoice sent via Baileys")
                return True

            if response.status_code == 503:
                try:
                    err = response.json().get("error", "")
                except Exception:
                    err = response.text
                logger.warning(f"⚠️ [InvoiceDelivery] Baileys session issue: {err}")
                return "session_not_connected"

            logger.error(f"❌ [InvoiceDelivery] Baileys error {response.status_code}: {response.text}")
            return False

        except requests.Timeout:
            logger.error("❌ [InvoiceDelivery] Baileys request timed out (30s)")
            return False
        except Exception as e:
            logger.error(f"❌ [InvoiceDelivery] WhatsApp delivery error: {e}", exc_info=True)
            return False

    # ─── Messenger / Instagram via Meta Graph API ────────────────────────────

    @classmethod
    def _send_meta(
        cls,
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str,
    ) -> bool:
        """
        Meta Graph API-তে সরাসরি image upload করে Messenger/Instagram DM পাঠায়।
        AgentAI model থেকে page_access_token খোঁজে নেয়।
        """
        try:
            from aiAgent.models import AgentAI

            # page_id খোঁজো — order-এর source_contact_id বা page_id থেকে
            page_id = (
                order_data.get("page_id")
                or order_data.get("source_page_id")
            )

            agent: Optional[AgentAI] = None
            if page_id:
                agent = AgentAI.objects.filter(page_id=page_id, platform=platform, is_active=True).first()

            # Fallback: user-এর যেকোনো active Meta agent
            if not agent:
                user_id = order_data.get("user_id")
                if user_id:
                    agent = (
                        AgentAI.objects.filter(user_id=user_id, platform=platform, is_active=True)
                        .order_by("-id")
                        .first()
                    )

            if not agent or not agent.access_token:
                logger.warning(f"⚠️ [InvoiceDelivery] No active {platform} agent/token found for order {order_data.get('id')}. Skipping.")
                return False

            access_token = agent.access_token

            # Step 1: Upload image as attachment to get attachment_id
            image_bytes = base64.b64decode(image_base64)
            upload_url = f"https://graph.facebook.com/v21.0/me/message_attachments?access_token={access_token}"

            upload_response = requests.post(
                upload_url,
                files={
                    "filedata": ("invoice.png", io.BytesIO(image_bytes), "image/png"),
                },
                data={
                    "message": '{"attachment":{"type":"image","payload":{"is_reusable":true}}}',
                },
                timeout=30,
            )

            if upload_response.status_code != 200:
                logger.error(f"❌ [InvoiceDelivery] Meta attachment upload failed: {upload_response.status_code} {upload_response.text}")
                return False

            attachment_id = upload_response.json().get("attachment_id")
            if not attachment_id:
                logger.error("❌ [InvoiceDelivery] Meta attachment upload returned no attachment_id")
                return False

            # Step 2: Send the uploaded attachment as DM
            send_url = f"https://graph.facebook.com/v21.0/me/messages?access_token={access_token}"
            dm_payload = {
                "recipient": {"id": sender_id},
                "message": {
                    "attachment": {
                        "type": "image",
                        "payload": {"attachment_id": attachment_id},
                    }
                },
            }
            send_response = requests.post(send_url, json=dm_payload, timeout=15)

            if send_response.status_code == 200:
                logger.info(f"✅ [InvoiceDelivery] {platform} invoice sent to {sender_id}")
                return True

            logger.error(f"❌ [InvoiceDelivery] {platform} send failed: {send_response.status_code} {send_response.text}")
            return False

        except Exception as e:
            logger.error(f"❌ [InvoiceDelivery] {platform} delivery error: {e}", exc_info=True)
            return False

    # ─── Telegram via Bot API ─────────────────────────────────────────────────

    @classmethod
    def _send_telegram(
        cls,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str,
    ) -> bool:
        """
        Telegram Bot API sendPhoto endpoint-এ invoice image পাঠায়।
        TelegramBot model থেকে bot_token খোঁজে নেয়।
        """
        try:
            from aiAgent.models import AgentAI, TelegramBot

            user_id = order_data.get("user_id")
            bot_token: Optional[str] = None

            # Prefer page_id (bot_username) lookup
            page_id = order_data.get("page_id") or order_data.get("source_page_id")
            if page_id:
                tg_bot = TelegramBot.objects.filter(bot_username=page_id, is_active=True).first()
                if tg_bot:
                    bot_token = tg_bot.bot_token

            # Fallback: user-এর যেকোনো active TelegramBot
            if not bot_token and user_id:
                tg_bot = (
                    TelegramBot.objects.filter(agent__user_id=user_id, is_active=True)
                    .order_by("-id")
                    .first()
                )
                if tg_bot:
                    bot_token = tg_bot.bot_token

            if not bot_token:
                logger.warning(f"⚠️ [InvoiceDelivery] No active Telegram bot token found for order {order_data.get('id')}. Skipping.")
                return False

            image_bytes = base64.b64decode(image_base64)
            url = f"https://api.telegram.org/bot{bot_token}/sendPhoto"

            response = requests.post(
                url,
                data={"chat_id": sender_id, "caption": message},
                files={"photo": ("invoice.png", io.BytesIO(image_bytes), "image/png")},
                timeout=30,
            )

            if response.status_code == 200:
                logger.info(f"✅ [InvoiceDelivery] Telegram invoice sent to chat {sender_id}")
                return True

            logger.error(f"❌ [InvoiceDelivery] Telegram sendPhoto failed: {response.status_code} {response.text}")
            return False

        except Exception as e:
            logger.error(f"❌ [InvoiceDelivery] Telegram delivery error: {e}", exc_info=True)
            return False
