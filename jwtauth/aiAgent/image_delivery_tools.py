# aiAgent/image_delivery_tools.py
"""
🖼️ Platform-Restricted Image Delivery Tools for AI Agent
Enables AI to fetch product images with platform restrictions
"""
import logging
import os
import requests
from typing import Optional, List, Dict, Any
from django.conf import settings
from django.http import HttpRequest

logger = logging.getLogger('aiAgent')


class ImageDeliveryTool:
    """
    Tool for fetching product images restricted to specific platform
    Used by AI agent when user asks for product images
    """
    
    ALLOWED_PLATFORMS = ['whatsapp', 'messenger', 'instagram', 'telegram', 'tiktok']
    
    def __init__(self, user_id: int, sheet_id: int, platform: str):
        """
        Initialize image delivery tool
        
        Args:
            user_id: Django user ID
            sheet_id: Spreadsheet ID where product images are stored
            platform: Platform requesting images (whatsapp, messenger, etc)
        """
        self.user_id = user_id
        self.sheet_id = sheet_id
        self.platform = platform.lower()
        self.base_url = (
            getattr(settings, 'API_BASE_URL', None)
            or os.environ.get('API_BASE_URL')
            or os.environ.get('INTERNAL_API_URL')
            or 'http://backend:8000'
        )
        logger.info(f"ImageDeliveryTool using base_url={self.base_url}")
        
    def validate(self) -> tuple[bool, str]:
        """Validate platform and configuration"""
        if self.platform not in self.ALLOWED_PLATFORMS:
            return False, f"Invalid platform. Allowed: {', '.join(self.ALLOWED_PLATFORMS)}"
        
        if not self.sheet_id or self.sheet_id <= 0:
            return False, "Invalid sheet_id"
        
        if not self.user_id or self.user_id <= 0:
            return False, "Invalid user_id"
        
        return True, "Valid"
    
    def get_presigned_urls(self, row_index: int, limit: int = 3, query: str = '', offset: int = 0) -> Optional[Dict[str, Any]]:
        """
        Fetch presigned URLs for images in a specific row
        
        Args:
            row_index: Row number to fetch images from
            limit: Maximum number of images to return (default: 3)
            query: Semantic search query
            offset: Image pagination offset
        
        Returns:
            Dictionary with presigned_urls, captions, platform, expires_in
            or None if error occurs
        """
        if not self.validate()[0]:
            return None
        
        try:
            # Call internal presigned URL endpoint
            endpoint = (
                f"{self.base_url}/api/datasheet/spreadsheets/{self.sheet_id}/"
                f"row-image-presigned-url/"
            )
            
            params = {
                'row_index': row_index,
                'platform': self.platform,
                'limit': limit,
                'query': query,
                'offset': offset,
            }
            
            # Build headers: include service-to-service secret or internal token if configured
            headers = {
                'X-User-ID': str(self.user_id),
                'Accept': 'application/json',
            }

            # Prefer a configured internal API secret (used widely across services)
            baileys_secret = getattr(settings, 'BAILEYS_API_SECRET', None) or os.environ.get('BAILEYS_API_SECRET')
            if baileys_secret:
                headers['x-api-secret'] = baileys_secret

            # Optional: include an internal bearer token if available
            internal_token = getattr(settings, 'INTERNAL_API_TOKEN', None) or os.environ.get('INTERNAL_API_TOKEN')
            if internal_token:
                headers['Authorization'] = f"Bearer {internal_token}"

            logger.info(f"ImageDeliveryTool calling presigned endpoint with headers: {', '.join(k for k in headers.keys())}")

            # Make request to presigned URL endpoint
            response = requests.get(
                endpoint,
                params=params,
                timeout=10,
                headers=headers
            )
            
            if response.status_code == 200:
                data = response.json()
                logger.info(
                    f"Got presigned URLs for {len(data.get('presigned_urls', []))} images "
                    f"from {self.platform}"
                )
                return data
            else:
                logger.error(f"Presigned URL endpoint error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching presigned URLs: {str(e)}")
            return None


def get_image_delivery_tool_definition():
    """
    Get Gemini function_calling tool definition for image delivery
    
    Returns:
        Tool definition compatible with Gemini API
    """
    return {
        "name": "get_product_images_with_presigned_urls",
        "description": (
            "Fetch images for a product row with platform-specific access control. "
            "Only returns presigned URLs valid for the requesting platform. "
            "Images are restricted and can only be served to WhatsApp, Messenger, Instagram, Telegram, or TikTok. "
            "Use this when user asks to see product images or when showing product details."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "row_index": {
                    "type": "integer",
                    "description": "The row index containing product images (0-based)"
                },
                "platform": {
                    "type": "string",
                    "enum": ["whatsapp", "messenger", "instagram", "telegram", "tiktok"],
                    "description": "The platform requesting the images"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of images to return (default: 3, max: 5)",
                    "default": 3
                },
                "query": {
                    "type": "string",
                    "description": "Optional semantic query/filter for image color or style (e.g. 'white', 'black', 'lal', 'sada')"
                },
                "offset": {
                    "type": "integer",
                    "description": "Pagination offset to skip previously sent images",
                    "default": 0
                }
            },
            "required": ["row_index", "platform"]
        }
    }


def execute_image_delivery_tool(
    user_id: int,
    sheet_id: int,
    tool_params: Dict[str, Any],
    agent_config=None
) -> Dict[str, Any]:
    """
    Execute image delivery tool call from AI agent
    
    Args:
        user_id: Django user ID
        sheet_id: Spreadsheet ID
        tool_params: Parameters from Gemini function_calling
        agent_config: Optional agent configuration for additional context
    
    Returns:
        Result with presigned URLs or error message
    """
    try:
        row_index = tool_params.get('row_index')
        platform = tool_params.get('platform', '').lower()
        limit = min(int(tool_params.get('limit', 3)), 5)  # Cap at 5
        query = tool_params.get('query', '')
        offset = int(tool_params.get('offset', 0))
        
        # Validate parameters
        if row_index is None:
            return {
                "status": "error",
                "message": "row_index parameter is required",
                "images": []
            }
        
        # Get tool instance
        tool = ImageDeliveryTool(user_id, sheet_id, platform)
        is_valid, validation_msg = tool.validate()
        
        if not is_valid:
            return {
                "status": "error",
                "message": f"Tool validation failed: {validation_msg}",
                "images": []
            }
        
        # Fetch presigned URLs
        result = tool.get_presigned_urls(row_index, limit, query, offset)
        
        if result:
            # Format result for AI consumption
            images = result.get('presigned_urls', [])
            return {
                "status": "success",
                "message": f"Found {len(images)} image(s) for row {row_index}",
                "platform": platform,
                "images": images,
                "expires_in": result.get('expires_in', 60),
                "total_matching": result.get('total_matching', len(images)),
                "offset": result.get('offset', offset),
                "row_id": result.get('row_id', f'sheet_{sheet_id}_row_{row_index}')
            }
        else:
            return {
                "status": "error",
                "message": "Failed to fetch presigned URLs",
                "images": []
            }
            
    except Exception as e:
        logger.error(f"Error executing image delivery tool: {str(e)}")
        return {
            "status": "error",
            "message": f"Error: {str(e)}",
            "images": []
        }


def format_images_for_ai_response(tool_result: Dict[str, Any]) -> str:
    """
    Format fetched images into natural text for AI response
    
    Args:
        tool_result: Result from execute_image_delivery_tool
    
    Returns:
        Formatted text ready for inclusion in AI response
    """
    if tool_result.get('status') == 'error':
        return f"❌ {tool_result.get('message', 'Unable to fetch images')}"
    
    images = tool_result.get('images', [])
    if not images:
        return "No images found for this product row."
    
    platform = tool_result.get('platform', 'platform')
    output = []
    
    for idx, img in enumerate(images, 1):
        url = img.get('url', '')
        caption = img.get('caption', 'Product image')
        
        output.append(f"{idx}. {caption}")
        if url:
            output.append(f"   🔗 [View Image]({url})")
    
    response_text = (
        f"✅ Found {len(images)} image(s) for this product "
        f"(exclusive to {platform}):\n\n" +
        "\n".join(output) +
        f"\n\n⏱️ Links expire in {tool_result.get('expires_in', 60)} seconds"
    )
    
    return response_text
