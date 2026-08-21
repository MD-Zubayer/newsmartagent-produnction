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
        message_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send images to WhatsApp
        WhatsApp uses Media objects with captions
        """
        try:
            from webhooks.whatsapp import send_whatsapp_message
            
            logger.info(f"Routing {len(image_urls)} images to WhatsApp: {recipient_id}")
            
            results = []
            
            # Send each image with its caption if available
            for idx, url in enumerate(image_urls):
                caption = captions[idx] if idx < len(captions) else None
                
                response = send_whatsapp_message(
                    recipient_id=recipient_id,
                    message_type='image',
                    image_url=url,
                    caption=caption,
                    agent_config=agent_config
                )
                results.append(response)
            
            # Send accompany message if provided
            if message_text:
                msg_response = send_whatsapp_message(
                    recipient_id=recipient_id,
                    message_type='text',
                    text=message_text,
                    agent_config=agent_config
                )
                results.append(msg_response)
            
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
    
    def _send_to_messenger(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send images to Messenger
        Messenger groups images in templates or individual messages
        """
        try:
            logger.info(f"Routing {len(image_urls)} images to Messenger: {recipient_id}")
            
            # Messenger implementation would go here
            # Similar pattern to WhatsApp but using Messenger API
            
            return {
                'status': 'success',
                'platform': 'messenger',
                'images_sent': len(image_urls),
                'note': 'Messenger implementation pending'
            }
            
        except Exception as e:
            logger.error(f"Error sending to Messenger: {str(e)}")
            return {
                'status': 'error',
                'platform': 'messenger',
                'error': str(e)
            }
    
    def _send_to_instagram(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send images to Instagram DMs
        Instagram API supports media in direct messages
        """
        try:
            logger.info(f"Routing {len(image_urls)} images to Instagram: {recipient_id}")
            
            return {
                'status': 'success',
                'platform': 'instagram',
                'images_sent': len(image_urls),
                'note': 'Instagram implementation pending'
            }
            
        except Exception as e:
            logger.error(f"Error sending to Instagram: {str(e)}")
            return {
                'status': 'error',
                'platform': 'instagram',
                'error': str(e)
            }
    
    def _send_to_telegram(
        self,
        recipient_id: str,
        image_urls: List[str],
        captions: List[str],
        agent_config,
        message_text: Optional[str] = None
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
        message_text: Optional[str] = None
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
        message_text: Optional[str] = None
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
            message_text=message_text
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
    message_text: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to route images
    
    Usage:
        route_images(
            'whatsapp',
            '+1234567890',
            ['https://minio.../img1.jpg?signature=...'],
            ['Product XYZ'],
            agent_config
        )
    """
    router = get_platform_router()
    return router.route_images(
        platform=platform,
        recipient_id=recipient_id,
        image_urls=image_urls,
        captions=captions,
        agent_config=agent_config,
        message_text=message_text
    )
