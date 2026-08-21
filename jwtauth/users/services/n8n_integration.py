"""
Invoice Delivery Service (n8n-মুক্ত)

n8n বাদ দেওয়া হয়েছে। এই file টি backward compatibility-র জন্য রাখা হয়েছে।
সব invoice delivery এখন integrations.services.invoice_delivery.InvoiceDeliveryService দিয়ে হয়।

সরাসরি পাঠানো:
  - WhatsApp   → Baileys /send-message-base64
  - Messenger  → Meta Graph API
  - Instagram  → Meta Graph API
  - Telegram   → Telegram Bot API
"""

import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class N8NInvoiceDelivery:
    """
    Backward-compatible wrapper।
    এখন সরাসরি InvoiceDeliveryService ব্যবহার করে।
    """

    @staticmethod
    def build_payload(
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str = "📋 Here's your invoice"
    ) -> Dict[str, Any]:
        """Legacy method — payload তৈরি করে (backward compat)."""
        import datetime
        base_payload = {
            'type': 'INVOICE_DELIVERY',
            'platform': platform,
            'recipient_id': sender_id,
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
            'order_id': order_data.get('id'),
            'customer_name': order_data.get('customer_name'),
            'phone': order_data.get('phone_number'),
            'message': message,
        }
        return base_payload

    @staticmethod
    def send_to_n8n(
        platform: str,
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str = "📋 Here's your invoice"
    ) -> bool:
        """
        Invoice image পাঠায়।
        পূর্বে n8n ব্যবহার করত। এখন সরাসরি InvoiceDeliveryService-এ redirect করে।

        Args:
            platform: 'whatsapp' | 'messenger' | 'instagram' | 'telegram'
            sender_id: Customer-এর platform ID
            image_base64: Invoice image base64
            order_data: Order details dict
            message: Caption

        Returns:
            True on success, False on failure.
            'session_not_connected' যদি WhatsApp session না থাকে।
        """
        from integrations.services.invoice_delivery import InvoiceDeliveryService
        logger.info(f"📤 [InvoiceDelivery] Routing to InvoiceDeliveryService → platform={platform}, sender={sender_id}")
        return InvoiceDeliveryService.send(
            platform=platform,
            sender_id=sender_id,
            image_base64=image_base64,
            order_data=order_data,
            message=message,
        )

    @staticmethod
    def _send_to_baileys_whatsapp(
        sender_id: str,
        image_base64: str,
        order_data: Dict[str, Any],
        message: str
    ) -> bool:
        """Legacy method — InvoiceDeliveryService._send_whatsapp-এ redirect করে।"""
        from integrations.services.invoice_delivery import InvoiceDeliveryService
        return InvoiceDeliveryService._send_whatsapp(sender_id, image_base64, order_data, message)

    @staticmethod
    def detect_platform_from_context(request_data: Dict[str, Any]) -> Optional[str]:
        """API request থেকে platform detect করে।"""
        if request_data.get('platform') or request_data.get('type'):
            platform = request_data.get('platform') or request_data.get('type')
            if platform in ['whatsapp', 'messenger', 'instagram', 'telegram', 'facebook_comment']:
                return platform

        if any(k in request_data for k in ['from', 'sessionId', 'jid', 'delivery_jid']):
            return 'whatsapp'

        if request_data.get('messaging'):
            return 'messenger'

        if request_data.get('update_id') or request_data.get('message'):
            return 'telegram'

        return None


class PlatformAutoDetector:
    """Order form থেকে আসা request-এ platform auto-detect করে।"""

    @staticmethod
    def detect_from_order_form(request_data: Dict[str, Any]) -> str:
        if 'source_platform' in request_data:
            return request_data['source_platform']
        if 'platform_from' in request_data:
            return request_data['platform_from']
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
