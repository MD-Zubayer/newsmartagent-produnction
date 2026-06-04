# aiAgent/caption_handler.py
"""
🎯 Smart Caption Handler for Image Responses
Shows captions ONLY when user explicitly asks for details (price, stock, offer, etc.)
"""
import logging
import re
from typing import Optional, Dict, List

logger = logging.getLogger('aiAgent')


class QueryAnalyzer:
    """
    Analyzes user query to determine whether the user is asking for product details
    or only wants to see the image.
    """

    # Patterns that usually indicate explicit product detail questions
    DETAIL_PATTERNS = {
        'price': [r'দাম', r'price', r'cost', r'টাকা', r'খরচ', r'মূল্য', r'how much', r'what(?:\s+is)?\s+the\s+price', r'কত টাকা'],
        'stock': [r'স্টক', r'stock', r'available', r'আছে', r'এভেইলেবল', r'quantity', r'qty', r'কত পিস', r'কতটা রয়ে গিয়েছে', r'কত আছে'],
        'offer': [r'অফার', r'ছাড়', r'discount', r'deal', r'sale', r'Offer', r'price\s+cut', r'দাম\s+কম', r'সাশ্রয়'],
        'feature': [r'ফিচার', r'feature', r'স্পেসিফিকেশন', r'spec', r'মাপ', r'সাইজ', r'রঙ', r'কী\s+বৈশিষ্ট্য', r'কি\s+দেখাবে'],
        'availability': [r'কিনতে পারি কি', r'আছে কি', r'পাওয়া যায় কি', r'কোথায় পাবো', r'available', r'can\s+buy', r'is\s+it\s+available', r'out\s+of\s+stock'],
        'info': [r'তথ্য', r'info', r'details?', r'এক্সপ্লেইন', r'কি', r'কত', r'কখন', r'why', r'how']
    }

    IMAGE_ONLY_PATTERNS = [
        r'দেখাও', r'দেখ', r'photo', r'image', r'ছবি', r'ফটো', r'show', r'send\s+image', r'send\s+photo', r'display'
    ]

    IMAGE_AND_DATA_PATTERNS = [
        r'ছবি.*(দাম|স্টক|অফার|তথ্য|details|price|stock|available|info|feature|বিশেষ|কোনো.+তথ্য)',
        r'(দাম|স্টক|অফার|তথ্য|details|price|stock|available|info|feature|বিশেষ|কোনো.+তথ্য).*ছবি',
        r'কি\s+(দাম|স্টক|অফার|info|তথ্য)',
        r'কত\s+(দাম|স্টক|পিস|মোট)',
        r'(দাম|স্টক|অফার|তথ্য)\s+সহ'
    ]

    QUESTION_PATTERNS = [
        r'\?', r'কি\b', r'কী\b', r'how\b', r'what\b', r'where\b', r'when\b', r'which\b', r'why\b'
    ]

    def __init__(self, user_query: str):
        """
        Initialize with user query

        Args:
            user_query: The user's message/question
        """
        self.query = user_query.lower().strip()
        self.detail_level = 'image_only'

    def _match_pattern(self, patterns):
        for pattern in patterns:
            if re.search(pattern, self.query):
                return pattern
        return None

    def _detect_detail_type(self):
        for detail_type, patterns in self.DETAIL_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, self.query):
                    return detail_type, pattern
        return None, None

    def _is_image_only_request(self):
        if self._match_pattern(self.IMAGE_ONLY_PATTERNS):
            detail_match = self._detect_detail_type()[0]
            if detail_match is None and not self._is_question_like():
                return True
            if self._match_pattern(self.IMAGE_AND_DATA_PATTERNS):
                return False
            if detail_match is None and self._match_pattern(self.IMAGE_AND_DATA_PATTERNS):
                return False
            return detail_match is None
        return False

    def _is_image_with_data_request(self):
        if self._match_pattern(self.IMAGE_AND_DATA_PATTERNS):
            return True
        if self._match_pattern(self.IMAGE_ONLY_PATTERNS) and self._detect_detail_type()[0] is not None:
            return True
        if self._match_pattern(self.IMAGE_ONLY_PATTERNS) and self._is_question_like() and self._detect_detail_type()[0] is None:
            # If user asks a question while mentioning image, assume they want data too.
            return True
        return False

    def _is_question_like(self):
        return bool(self._match_pattern(self.QUESTION_PATTERNS))

    def analyze(self) -> Dict[str, any]:
        """
        Analyze query to determine detail requirement

        Returns:
            Dict with:
            - wants_details: bool
            - detail_type: str (price, stock, offer, feature, availability, info)
            - detail_level: str (image_only, with_caption, detailed)
            - confidence: float (0-1)
        """
        result = {
            'wants_details': False,
            'detail_type': None,
            'detail_level': 'image_only',
            'confidence': 0.0,
            'keywords_matched': []
        }

        # If it's clearly an image-only request, do not add captions.
        if self._is_image_only_request():
            logger.info(f"Detected image-only request: {self.query[:80]}")
            return result

        if self._is_image_with_data_request():
            detail_type, matched_pattern = self._detect_detail_type()
            result['wants_details'] = True
            result['detail_type'] = detail_type or 'info'
            result['detail_level'] = 'with_caption' if result['detail_type'] == 'price' else 'detailed'
            result['confidence'] = 0.95 if self._is_question_like() else 0.75
            if matched_pattern:
                result['keywords_matched'].append(matched_pattern)
            logger.info(f"Image+data request detected: {result['detail_type']} (query: {self.query[:80]})")
            return result

        detail_type, matched_pattern = self._detect_detail_type()
        if detail_type:
            result['wants_details'] = True
            result['detail_type'] = detail_type
            result['detail_level'] = 'with_caption' if detail_type == 'price' else 'detailed'
            result['confidence'] = 0.95 if self._is_question_like() else 0.8
            result['keywords_matched'].append(matched_pattern)
            logger.info(f"Detail request detected: {detail_type} (pattern: {matched_pattern})")
            return result

        # If the query looks like a question and isn't only about image display,
        # infer that the user probably wants more than a picture.
        if self._is_question_like() and not self._is_image_only_request():
            result['wants_details'] = True
            result['detail_type'] = 'info'
            result['detail_level'] = 'detailed'
            result['confidence'] = 0.75
            logger.info(f"Inferred detail request from question structure: {self.query[:80]}")
            return result

        # Otherwise, assume user wants image-only response.
        logger.info(f"Defaulting to image-only for query: {self.query[:80]}")
        return result


def build_response_with_captions(
    images: List[Dict],
    user_query: str,
    product_name: Optional[str] = None,
    product_price: Optional[float] = None,
    product_stock: Optional[int] = None,
    extra_info: Optional[Dict] = None
) -> str:
    """
    Build response with captions ONLY if user asked for details
    
    Args:
        images: List of image dicts with 'url', 'caption', 'position'
        user_query: User's original question
        product_name: Product name from catalog
        product_price: Product price from catalog
        product_stock: Available quantity
        extra_info: Additional product information
    
    Returns:
        Formatted response string ready for AI/user
    """
    if not images:
        return "❌ No images available for this product."
    
    # Analyze query to see if captions are needed
    analyzer = QueryAnalyzer(user_query)
    analysis = analyzer.analyze()
    
    response_parts = []
    
    # Always show the images
    response_parts.append("📸 Product Images:\n")
    for idx, img in enumerate(images, 1):
        url = img.get('url', '')
        # Don't show caption here - just the image URL
        response_parts.append(f"{idx}. [View Image]({url})")
    
    # ONLY add caption text if user explicitly asked for details
    if analysis['wants_details']:
        response_parts.append("\n📝 Details:")
        
        detail_type = analysis['detail_type']
        
        if detail_type == 'price' and product_price:
            response_parts.append(f"💱 Price: {product_price:,} TK")
        
        if detail_type == 'stock' and product_stock is not None:
            status = f"✅ {product_stock} items available"
            if product_stock == 0:
                status = "❌ Out of stock"
            elif product_stock < 5:
                status = f"⚠️ Only {product_stock} left"
            response_parts.append(status)
        
        if detail_type == 'offer' and extra_info:
            if 'discount' in extra_info:
                response_parts.append(f"🎉 Discount: {extra_info['discount']}")
        
        if detail_type == 'feature' and extra_info:
            if 'features' in extra_info:
                response_parts.append(f"⭐ Features:\n{extra_info['features']}")
        
        if detail_type == 'availability':
            response_parts.append(f"📦 In stock: Yes")
        
        if product_name:
            response_parts.append(f"\n📦 Product: {product_name}")
    
    # Add image expiry notice
    response_parts.append("\n⏱️ Images expire in 60 seconds")
    
    return "\n".join(response_parts)


def extract_product_details_from_spreadsheet(
    spreadsheet_data: Dict,
    row_index: int
) -> Dict[str, any]:
    """
    Extract product details from spreadsheet row
    
    Args:
        spreadsheet_data: Spreadsheet data dict {'0-0': 'Header', '1-0': 'Value', ...}
        row_index: The row to extract from
    
    Returns:
        Dict with product_name, price, stock, etc.
    """
    details = {
        'product_name': '',
        'price': None,
        'stock': None,
        'extra_info': {}
    }
    
    try:
        # Assume Row 0 is header
        # Column 0: Product Name
        # Column 1: Price
        # Column 2: Stock/Availability
        # Column 3: Features/Notes
        
        key_name = f"{row_index}-0"
        key_price = f"{row_index}-1"
        key_stock = f"{row_index}-2"
        key_features = f"{row_index}-3"
        
        if key_name in spreadsheet_data:
            details['product_name'] = str(spreadsheet_data[key_name]).strip()
        
        if key_price in spreadsheet_data:
            try:
                details['price'] = float(spreadsheet_data[key_price])
            except (ValueError, TypeError):
                pass
        
        if key_stock in spreadsheet_data:
            try:
                details['stock'] = int(spreadsheet_data[key_stock])
            except (ValueError, TypeError):
                pass
        
        if key_features in spreadsheet_data:
            details['extra_info']['features'] = str(spreadsheet_data[key_features]).strip()
        
        return details
        
    except Exception as e:
        logger.error(f"Error extracting product details: {str(e)}")
        return details


def should_include_image_caption(user_query: str, detail_type: Optional[str] = None) -> bool:
    """
    Determine if image caption should be included in response
    
    Args:
        user_query: User's query
        detail_type: Type of detail (price, stock, etc.) if identified
    
    Returns:
        bool: True if caption should be included
    """
    analyzer = QueryAnalyzer(user_query)
    analysis = analyzer.analyze()
    return analysis['wants_details']
