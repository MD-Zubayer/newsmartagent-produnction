"""
N8N Integration Service + Direct Baileys Delivery
Django থেকে N8N webhook call করে invoice image deliver করে user এর প্ল্যাটফর্মে
Or directly to Baileys for WhatsApp
"""

import requests
import logging
import json
import os
from typing import Optional, Dict, Any
from django.conf import settings

logger = logging.getLogger(__name__)


class N8NInvoiceDelivery:
    """N8N দিয়ে invoice deliver করার সার্ভিস"""
    
    # Platform specific N8N webhook URLs (আপনার existing env variables থেকে)
    WEBHOOK_URLS = {
        'whatsapp': getattr(settings, 'N8N_WHATSAPP_DELIVERY_URL', '') or getattr(settings, 'N8N_WHATSAPP_WEBHOOK_URL', ''),
        'messenger': getattr(settings, 'N8N_MESSENGER_WEBHOOK_URL', '') or getattr(settings, 'N8N_MESSENGER_WEBHOOK', ''),
        'instagram': getattr(settings, 'N8N_INSTAGRAM_WEBHOOK_URL', '') or getattr(settings, 'N8N_INSTAGRAM_WEBHOOK', ''),
        'telegram': getattr(settings, 'N8N_TELEGRAM_DELIVERY_URL', '') or getattr(settings, 'N8N_TELEGRAM_WEBHOOK_URL', ''),
        'facebook_comment': getattr(settings, 'N8N_FACEBOOK_WEBHOOK_URL', '') or getattr(settings, 'N8N_FACEBOOK_WEBHOOK', ''),
    }
    
    @staticmethod
    def build_payload(
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str = "📋 Here's your invoice"
    ) -> Dict[str, Any]:
        """
        N8N এর জন্য payload তৈরি করে
        
        Args:
            platform: 'whatsapp', 'messenger', 'instagram', 'telegram'
            sender_id: Customer এর platform-specific ID
            image_base64: Invoice image base64 string
            order_data: Order details dict
            message: Caption for the image
        
        Returns:
            N8N payload dict
        """
        
        base_payload = {
            'type': 'INVOICE_DELIVERY',
            'platform': platform,
            'recipient_id': sender_id,
            'timestamp': __import__('datetime').datetime.utcnow().isoformat() + 'Z',
            'order_id': order_data.get('id'),
            'customer_name': order_data.get('customer_name'),
            'phone': order_data.get('phone_number'),
            'message': message,
        }
        
        # Platform specific payload structure
        if platform == 'whatsapp':
            payload = {
                **base_payload,
                'delivery_type': 'media_message',
                'media': {
                    'type': 'image',
                    'base64': image_base64,
                    'caption': message
                },
                'jid': f"{sender_id}@s.whatsapp.net" if '@' not in sender_id else sender_id,
            }
        
        elif platform == 'messenger':
            payload = {
                **base_payload,
                'delivery_type': 'image_attachment',
                'image_data': image_base64,
                'recipient': sender_id,
            }
        
        elif platform == 'instagram':
            payload = {
                **base_payload,
                'delivery_type': 'dm_image',
                'image_data': image_base64,
                'user_id': sender_id,
            }
        
        elif platform == 'telegram':
            payload = {
                **base_payload,
                'delivery_type': 'photo',
                'photo_base64': image_base64,
                'chat_id': sender_id,
                'caption': message,
            }
        
        else:
            payload = base_payload
        
        return payload
    
    @staticmethod
    def send_to_n8n(
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str = "📋 Here's your invoice"
    ) -> bool:
        """
        Invoice image পাঠায় - WhatsApp এর জন্য সরাসরি Baileys, অন্যদের জন্য N8N
        
        Args:
            platform: Messaging platform
            sender_id: Customer ID on that platform
            image_base64: Invoice image in base64
            order_data: Order details
            message: Message caption
        
        Returns:
            Success status
        """
        
        # ━━━ WhatsApp: সরাসরি Baileys এ পাঠাও ━━━
        if platform.lower() == 'whatsapp':
            logger.info(f"📱 WhatsApp detected: routing to Baileys directly (not via N8N)")
            return N8NInvoiceDelivery._send_to_baileys_whatsapp(
                sender_id=sender_id,
                image_base64=image_base64,
                order_data=order_data,
                message=message
            )
        
        # ━━━ অন্যান্য platform: N8N এর মাধ্যমে পাঠাও ━━━
        webhook_url = N8NInvoiceDelivery.WEBHOOK_URLS.get(platform)
        
        if not webhook_url:
            logger.warning(f"⚠️ No N8N webhook URL configured for platform: {platform}")
            return False
        
        try:
            payload = N8NInvoiceDelivery.build_payload(
                platform=platform,
                sender_id=sender_id,
                image_base64=image_base64,
                order_data=order_data,
                message=message
            )
            
            logger.info(f"📤 Sending invoice to N8N ({platform}) for customer {sender_id}")
            
            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code in [200, 202, 204]:
                logger.info(f"✅ Invoice delivered via N8N to {platform} | {sender_id}")
                return True
            else:
                logger.error(
                    f"❌ N8N webhook failed ({platform}): "
                    f"Status {response.status_code} - {response.text}"
                )
                return False
        
        except requests.timeout:
            logger.error(f"❌ N8N request timeout for {platform}")
            return False
        except Exception as e:
            logger.error(f"❌ Failed to send invoice via N8N ({platform}): {e}")
            return False
    
    @staticmethod
    def _send_to_baileys_whatsapp(
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str
    ) -> bool:
        """
        Baileys container এর /send-message-base64 endpoint এ রেকোয়েস্ট করে
        WhatsApp invoice image পাঠায়।
        
        Args:
            sender_id: WhatsApp number (e.g., 8801234567890)
            image_base64: Invoice image in base64
            order_data: Order details
            message: Message caption
        
        Returns:
            Success status
        """
        
        try:
            # Baileys URL (Docker Compose এ baileys service port গুলো)
            baileys_url = os.environ.get('BAILEYS_API_URL') or 'http://baileys:3001'
            baileys_secret = os.environ.get('BAILEYS_API_SECRET', 'nsa-baileys-secret-2024')
            env_session = os.environ.get('BAILEYS_SESSION_ID')
            # Prefer explicit env session; otherwise derive per-user session id
            user_id = order_data.get('user_id') if order_data else None
            if env_session and env_session != 'default':
                baileys_session_id = env_session
            else:
                baileys_session_id = f"user_{user_id}" if user_id else 'default'

            # Extract phone number (remove country code if present)
            phone = sender_id.strip().lstrip('+')
            if phone.startswith('880'):
                # Keep Bangladesh number as-is
                pass
            elif phone.startswith('0'):
                # Convert 0 to 880
                phone = '88' + phone[1:]
            
            logger.info(f"📱 [Baileys] Calling {baileys_url}/send-message-base64")
            logger.info(f"   Phone: {phone}")
            logger.info(f"   SessionID: {baileys_session_id}")
            logger.info(f"   Image size: {len(image_base64) / 1024:.2f} KB")
            
            payload = {
                'sessionId': baileys_session_id,
                'to': phone,
                'image_base64': image_base64,
                'caption': message,
                'metadata': {
                    'order_id': order_data.get('id') if order_data else None,
                    'user_id': user_id
                }
            }
            
            response = requests.post(
                f"{baileys_url}/send-message-base64",
                json=payload,
                headers={
                    'Content-Type': 'application/json',
                    'X-API-Secret': baileys_secret
                },
                timeout=30
            )
            
            # Handle specific Baileys responses
            if response.status_code in [200, 202, 204]:
                logger.info(f"✅ Invoice image sent to WhatsApp via Baileys")
                try:
                    logger.info(f"   Response: {response.json()}")
                except Exception:
                    logger.debug("   Response not JSON")
                return True

            # If Baileys reports session not connected, surface that explicitly
            if response.status_code == 503:
                try:
                    body = response.json()
                    err = body.get('error', '')
                except Exception:
                    err = response.text
                logger.warning(f"⚠️ Baileys reports session issue: {err}")
                return 'session_not_connected'

            # Other failures
            logger.error(
                f"❌ Baileys /send-message-base64 failed: "
                f"Status {response.status_code} - {response.text}"
            )
            return False
        
        except requests.timeout:
            logger.error(f"❌ Baileys request timeout (30s)")
            return False
        except Exception as e:
            logger.error(f"❌ Failed to send invoice to Baileys: {e}", exc_info=True)
            return False
    
    @staticmethod
    def detect_platform_from_context(request_data: Dict[str, Any]) -> Optional[str]:
        """
        API request থেকে platform detect করে
        
        Args:
            request_data: Request data dictionary
        
        Returns:
            Platform name or None
        """
        
        # যদি explicitly platform দেওয়া থাকে
        if request_data.get('platform') or request_data.get('type'):
            platform = request_data.get('platform') or request_data.get('type')
            if platform in ['whatsapp', 'messenger', 'instagram', 'telegram', 'facebook_comment']:
                return platform
        
        # WhatsApp indicators
        if any(k in request_data for k in ['from', 'sessionId', 'jid', 'delivery_jid']):
            return 'whatsapp'
        
        # Messenger/Instagram indicators
        if request_data.get('messaging'):
            return 'messenger'
        
        # Telegram indicators
        if request_data.get('update_id') or request_data.get('message'):
            return 'telegram'
        
        return None


class PlatformAutoDetector:
    """Order form থেকে আসা request এ platform auto-detect করে"""
    
    @staticmethod
    def detect_from_order_form(request_data: Dict[str, Any]) -> str:
        """
        Order form submission থেকে platform detect করে
        
        যদি form এ কোন platform info নেই, তবে 'web' হবে (default)
        
        Args:
            request_data: Order form data
        
        Returns:
            Platform name
        """
        
        # যদি explicitly platform pass করা হয়
        if 'source_platform' in request_data:
            return request_data['source_platform']
        
        # Referrer header থেকে প্ল্যাটফর্ম detect করতে পারি
        # (এটা HTTP context থেকে আসবে, এখন skip)
        
        # Metadata থেকে
        if 'platform_from' in request_data:
            return request_data['platform_from']
        
        # N8N থেকে আসা request
        if 'n8n_platform' in request_data:
            return request_data['n8n_platform']
        
        # Default web form
        return 'web'
    
    @staticmethod
    def detect_from_message_context(request_data: Dict[str, Any]) -> str:
        """
        Message webhook থেকে platform detect করে
        """
        return N8NInvoiceDelivery.detect_platform_from_context(request_data) or 'web'
