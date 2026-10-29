# aiAgent/platform_image_router.py
"""
🚀 Platform Image Router
Routes images to correct platform send function with presigned URLs only
Ensures images are delivered ONLY to the requesting platform
"""
import logging
from typing import Dict, List, Optional, Callable, Any
from django.conf import settings

logger = logging.getLogger('aiAgent')


class PlatformImageRouter:
    """
    Central router for sending images to different platforms
    Each platform gets ONLY the presigned URLs + captions if applicable
    """
    
    PLATFORMS = ['whatsapp', 'messenger', 'instagram', 'telegram', 'tiktok']
    
    def __init__(self):
        """Initialize platform handlers"""
        self.handlers = {}
        self._register_handlers()
    
    def _register_handlers(self):
        """Register send functions for each platform"""
        self.handlers = {
            'whatsapp': self._send_to_whatsapp,
            'messenger': self._send_to_messenger,
            'instagram': self._send_to_instagram,
            'telegram': self._send_to_telegram,
            'tiktok': self._send_to_tiktok,
        }
    
    def _send_to_whatsapp(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send images to WhatsApp
        WhatsApp uses Media objects with captions
        """
        try:
            from webhooks.whatsapp import send_whatsapp_message
            
            logger.info(f"Routing {len(image_urls)} images to WhatsApp: {recipient_id}")
            
            results = []

            # 1. Send accompany text FIRST so user sees context before images
            if message_text:
                msg_response = send_whatsapp_message(
                    recipient_id=recipient_id,
                    message_type='text',
                    text=message_text,
                    agent_config=agent_config
                )
                results.append(msg_response)
            
            # Send each image with its caption if available
            # Send each image without captions (never send English captions on WhatsApp)
            # 2. Send each image without captions (never send English captions on WhatsApp)
            for idx, url in enumerate(image_urls):
                caption = captions[idx] if idx < len(captions) else None
                
                response = send_whatsapp_message(
                    recipient_id=recipient_id,
                    message_type='image',
                    image_url=url,
                    caption=None,
                    agent_config=agent_config
                )
                results.append(response)
            
            
            return {
                'status': 'success',
                'platform': 'whatsapp',
                'images_sent': len(image_urls),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Error sending to WhatsApp: {str(e)}")
            return {
                'status': 'error',
                'platform': 'whatsapp',
                'error': str(e)
            }
    
    def _resolve_meta_token(self, agent_config):
        """Resolve Page access token for Messenger/Instagram sends."""
        token = None
        try:
            from users.models import FacebookPage
            fb_page = FacebookPage.objects.filter(
                page_id=agent_config.page_id, is_active=True
            ).first()
            if fb_page and fb_page.access_token:
                token = fb_page.access_token
        except Exception as e:
            logger.warning(f"Meta token lookup via FacebookPage failed: {e}")
        return token or getattr(agent_config, 'access_token', None)

    def _send_via_meta(
        self,
        platform: str,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None,
        product: Optional[Any] = None,
        **kwargs
    ):
        from integrations.services.meta import MetaService
        try:
            logger.info(f"Routing {len(image_urls)} product card image(s) to {platform}: {recipient_id}")
            token = self._resolve_meta_token(agent_config)
            if not token:
                return {'status': 'error', 'platform': platform, 'error': 'Missing access token'}

            merchant = getattr(agent_config, 'user', None)

            # Construct Generic Template product cards
            elements = []
            for idx, url in enumerate(image_urls[:10]):
                cap = captions[idx] if idx < len(captions) and captions[idx] else None
                current_prod = product

                # If no product was explicitly passed, attempt lookup by caption
                if not current_prod and cap and merchant:
                    try:
                        from datasheet.models import Product
                        current_prod = Product.objects.filter(
                            user=merchant, status='active', name__iexact=str(cap).strip()
                        ).first()
                        if not current_prod:
                            current_prod = Product.objects.filter(
                                user=merchant, status='active', name__icontains=str(cap).strip()[:30]
                            ).first()
                    except Exception as match_err:
                        logger.debug(f"Product auto-match failed: {match_err}")

                # Card Title (max 80 chars)
                if current_prod and getattr(current_prod, 'name', None):
                    card_title = current_prod.name
                elif cap:
                    card_title = cap
                else:
                    card_title = "পণ্য বিবরণী"
                card_title = str(card_title).strip()[:80]

                # Subtitle with price (max 80 chars)
                price = None
                if current_prod:
                    price = getattr(current_prod, 'sale_price', None) or getattr(current_prod, 'base_price', None)

                if price:
                    try:
                        price_val = float(price)
                        card_title = f"{card_title} — ৳{price_val:,.0f}"[:80]
                        card_subtitle = f"মূল্য: ৳{price_val:,.0f} (ক্যাশ অন ডেলিভারি)"
                    except Exception:
                        card_title = f"{card_title} — ৳{price}"[:80]
                        card_subtitle = f"মূল্য: ৳{price} (ক্যাশ অন ডেলিভারি)"
                elif cap and cap != card_title:
                    card_subtitle = str(cap)[:80]
                else:
                    card_subtitle = "অর্ডার করতে চাপ দিন"
                card_subtitle = card_subtitle[:80]

                # Action URLs
                card_order_url = None
                card_details_url = None
                if current_prod and merchant:
                    try:
                        from storefront.services.checkout_link import create_checkout_session, get_checkout_url, get_shop_base_url
                        sess = create_checkout_session(
                            merchant=merchant,
                            agent=agent_config,
                            items=[{
                                'product_id': current_prod.id,
                                'name': current_prod.name,
                                'price': float(price or 0),
                                'quantity': 1,
                                'image_url': url
                            }],
                            source_platform=platform
                        )
                        card_order_url = get_checkout_url(sess)
                        card_details_url = f"{get_shop_base_url()}/shop/{sess.code}"
                    except Exception as sess_err:
                        logger.warning(f"Failed to create checkout session for card: {sess_err}")

                if not card_order_url:
                    try:
                        from storefront.services.checkout_link import get_shop_base_url
                        shop_base = get_shop_base_url()
                        card_order_url = f"{shop_base}/shop"
                        card_details_url = f"{shop_base}/shop"
                    except Exception:
                        card_order_url = "https://shop.newsmartagent.com/shop"
                        card_details_url = "https://shop.newsmartagent.com/shop"

                prod_id_val = getattr(current_prod, 'id', 0) if current_prod else 0
                details_payload = f"DETAILS:{prod_id_val}:{card_title}"

                element = {
                    "title": card_title,
                    "subtitle": card_subtitle,
                    "image_url": str(url).strip(),
                    "default_action": {
                        "type": "web_url",
                        "url": card_order_url,
                        "webview_height_ratio": "full",
                        "messenger_extensions": False
                    },
                    "buttons": [
                        {
                            "type": "web_url",
                            "url": card_order_url,
                            "title": "🛒 অর্ডার",
                            "webview_height_ratio": "full",
                            "messenger_extensions": False
                        }
                    ]
                }
                elements.append(element)

            # 1. Send accompany text FIRST so user sees context before images
            if message_text:
                MetaService.send_message(
                    access_token=token,
                    recipient_id=str(recipient_id),
                    message_text=message_text,
                    msg_type='text',
                )

            # Resolve quick replies to dock side-by-side (ডান-বাম দিকে) at the bottom
            quick_replies = None
            try:
                from aiAgent.models import Contact
                from aiAgent.business_logic.logic_handler import get_button_payload
                contact = Contact.objects.filter(agent=agent_config, identifier=recipient_id).first()
                buttons = get_button_payload(contact) if contact else []

                qr_items = []
                short_titles = {
                    "HUMAN_HELP": "Human",
                    "RESOLVE_HUMAN": "Resolve Human",
                    "STOP_AI_REPLY": "Stop AI",
                    "ON_AI_REPLY": "On AI"
                }
                for b in buttons:
                    act = b.get("action")
                    if act in short_titles:
                        qr_items.append({
                            "content_type": "text",
                            "title": short_titles[act][:20],
                            "payload": act
                        })

                quick_replies = qr_items[:5]
            except Exception as qr_err:
                logger.debug(f"Failed to attach side-by-side quick replies to image message: {qr_err}")

            # 2. Deliver Product Card(s) as Generic Template BELOW the text (square ratio = full image without crop)
            template_delivered = False
            if elements:
                template_delivered = MetaService.send_generic_template(
                    access_token=token,
                    recipient_id=str(recipient_id),
                    elements=elements,
                    image_aspect_ratio="square",
                    quick_replies=quick_replies,
                )

            if template_delivered:
                logger.info(f"Successfully sent {len(elements)} product card(s) via generic template to {platform}: {recipient_id}")
                return {'status': 'success', 'platform': platform, 'cards_sent': len(elements)}

            # Fallback: Send standard bare images if template delivery fails
            logger.warning(f"{platform} generic template delivery was not accepted, falling back to standard image send.")
            sent = 0
            for idx, url in enumerate(image_urls[:5]):
                is_last = (idx == len(image_urls[:5]) - 1)
                ok = MetaService.send_message(
                    access_token=token,
                    recipient_id=str(recipient_id),
                    message_text='',
                    msg_type='image',
                    media_url=str(url).strip(),
                    quick_replies=quick_replies if is_last else None,
                )
                if ok:
                    sent += 1
                else:
                    logger.error(f"{platform} image send failed for url={url}")

            if sent > 0:
                return {'status': 'success', 'platform': platform, 'images_sent': sent}

            return {'status': 'error', 'platform': platform, 'error': 'All image sends failed'}
        except Exception as e:
            logger.error(f"Error sending to {platform}: {str(e)}", exc_info=True)
            return {'status': 'error', 'platform': platform, 'error': str(e)}

    def _send_to_messenger(self, recipient_id, image_urls, captions, agent_config, message_text=None, product=None, **kwargs):
        """Send images as Product Cards or Carousel to Messenger via Graph Send API"""
        return self._send_via_meta('messenger', recipient_id, image_urls, captions, agent_config, message_text=message_text, product=product, **kwargs)

    def _send_to_instagram(self, recipient_id, image_urls, captions, agent_config, message_text=None, product=None, **kwargs):
        """Send images as Product Cards or Carousel to Instagram DMs via Graph Send API"""
        return self._send_via_meta('instagram', recipient_id, image_urls, captions, agent_config, message_text=message_text, product=product, **kwargs)

    def _send_to_telegram(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send images to Telegram
        Telegram supports captions directly with media
        """
        try:
            from webhooks.telegram import send_telegram_message
            
            logger.info(f"Routing {len(image_urls)} images to Telegram: {recipient_id}")
            
            results = []
            
            # Send each image
            for idx, url in enumerate(image_urls):
                caption = captions[idx] if idx < len(captions) else None
                
                response = send_telegram_message(
                    chat_id=recipient_id,
                    message_type='photo',
                    photo_url=url,
                    caption=caption,
                    agent_config=agent_config
                )
                results.append(response)
            
            # Send message if provided
            if message_text:
                msg_response = send_telegram_message(
                    chat_id=recipient_id,
                    message_type='text',
                    text=message_text,
                    agent_config=agent_config
                )
                results.append(msg_response)
            
            return {
                'status': 'success',
                'platform': 'telegram',
                'images_sent': len(image_urls),
                'results': results
            }
            
        except Exception as e:
            logger.error(f"Error sending to Telegram: {str(e)}")
            return {
                'status': 'error',
                'platform': 'telegram',
                'error': str(e)
            }
    
    def _send_to_tiktok(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send images to TikTok
        TikTok DM implementation
        """
        try:
            logger.info(f"Routing {len(image_urls)} images to TikTok: {recipient_id}")
            
            return {
                'status': 'success',
                'platform': 'tiktok',
                'images_sent': len(image_urls),
                'note': 'TikTok implementation pending'
            }
            
        except Exception as e:
            logger.error(f"Error sending to TikTok: {str(e)}")
            return {
                'status': 'error',
                'platform': 'tiktok',
                'error': str(e)
            }
    
    def route_images(
        self,
        platform: str,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None,
        product: Optional[Any] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Route images to correct platform handler
        
        Args:
            platform: Target platform (whatsapp, messenger, instagram, telegram, tiktok)
            recipient_id: User/chat ID on that platform
            image_urls: List of presigned image URLs
            captions: List of captions (one per image, or subset)
            agent_config: AgentAI configuration
            message_text: Optional accompanying message
            product: Optional Product model instance for rich product cards
        
        Returns:
            Result from platform handler
        """
        platform = platform.lower()
        
        if platform not in self.PLATFORMS:
            return {
                'status': 'error',
                'message': f"Unsupported platform: {platform}",
                'allowed': self.PLATFORMS
            }
        
        if not recipient_id or not str(recipient_id).strip():
            return {
                'status': 'error',
                'message': 'Recipient ID is required'
            }
        
        if not image_urls:
            return {
                'status': 'error',
                'message': 'No image URLs provided'
            }
        
        handler = self.handlers.get(platform)
        if not handler:
            return {
                'status': 'error',
                'message': f"No handler registered for {platform}"
            }
        
        logger.info(
            f"Routing {len(image_urls)} image(s) to {platform} ({recipient_id})"
        )
        
        return handler(
            recipient_id=recipient_id,
            image_urls=image_urls,
            captions=captions,
            agent_config=agent_config,
            message_text=message_text,
            product=product,
            **kwargs
        )


# Global router instance
_router_instance = None


def get_platform_router() -> PlatformImageRouter:
    """Get or create platform router instance"""
    global _router_instance
    if _router_instance is None:
        _router_instance = PlatformImageRouter()
    return _router_instance


def route_images(
    platform: str,
    recipient_id: str,
    image_urls: List[str],
    captions: List[str],
    agent_config,
    message_text: Optional[str] = None,
    product: Optional[Any] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function to route images
    
    Usage:
        route_images(
            'messenger',
            '1234567890',
            ['https://dev-s3.../img1.jpg'],
            ['Product XYZ'],
            agent_config,
            product=product
        )
    """
    router = get_platform_router()
    return router.route_images(
        platform=platform,
        recipient_id=recipient_id,
        image_urls=image_urls,
        captions=captions,
        agent_config=agent_config,
        message_text=message_text,
        product=product,
        **kwargs
    )
