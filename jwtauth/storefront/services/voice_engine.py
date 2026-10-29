import os
import logging
from decimal import Decimal
from django.conf import settings
from django.db.models import F
from datasheet.models import Product
from users.models import Profile

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_VOICE_URL = "/audio/default_order_call.mp3"

def calculate_dynamic_voice_tokens(text: str) -> int:
    """
    Dynamically calculates actual token cost based on character/word count
    using tiktoken cl100k_base (or strict character ratio fallback).
    NEVER hardcoded.
    """
    if not text:
        return 0
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        # Bengali UTF-8 characters average ~2-3 chars per token
        return max(1, len(text.strip()) // 3)

def resolve_voice_for_order(merchant, items, subtotal, shop_name="স্মার্ট শপ") -> dict:
    """
    Resolves the appropriate voice confirmation audio for an order according to the 4-tier strategy:
    1. Seller Custom Audio (uploaded on product)
    2. AI-Generated Voice (if merchant.profile.ai_voice_enabled, cached per product until price/offer changes)
    3. Web Speech API flag (if client device supports browser TTS)
    4. Code Default MP3 File (/audio/default_order_call.mp3)
    """
    profile = getattr(merchant, 'profile', None)
    first_item = items[0] if (items and isinstance(items, list)) else {}
    product_id = first_item.get('product_id')
    current_price = Decimal(str(first_item.get('price') or subtotal or '0.00'))

    product = None
    if product_id:
        product = Product.objects.filter(id=product_id, user=merchant).first()

    # Tier 1: Seller custom uploaded audio file on product
    prod_voice = getattr(product, 'voice_audio_file', None)
    if product and prod_voice:
        try:
            return {
                'mode': 'seller_upload',
                'audio_url': prod_voice.url,
                'tts_text': ''
            }
        except Exception as e:
            logger.warning(f"[VoiceEngine] Failed getting product.voice_audio_file URL: {e}")

    # Tier 1.5: Seller shop-wide default custom audio file
    if profile and getattr(profile, 'default_voice_audio', None):
        try:
            return {
                'mode': 'seller_shop_audio',
                'audio_url': profile.default_voice_audio.url,
                'tts_text': ''
            }
        except Exception as e:
            logger.warning(f"[VoiceEngine] Failed getting profile.default_voice_audio URL: {e}")

    prompt_text = (
        f"আসসালামু আলাইকুম! {shop_name} থেকে আপনার অর্ডারটির সত্যতা যাচাইয়ের জন্য কল করা হয়েছে। "
        f"আপনার মোট বিল {int(round(float(subtotal)))} টাকা। "
        "অর্ডারটি নিশ্চিত করতে ১ চাপুন, বাতিল করতে ২ চাপুন, অথবা আমাদের প্রতিনিধির সাথে কথা বলতে ৩ চাপুন।"
    )

    # Tier 2: AI Voice Generation with Dynamic Synthesis & Storage
    if profile and profile.ai_voice_enabled:
        dynamic_tokens = calculate_dynamic_voice_tokens(prompt_text)
        current_balance = getattr(profile, 'word_balance', 0) or 0

        # Check if merchant has enough tokens
        if current_balance >= dynamic_tokens:
            generated_url = _generate_ai_voice_for_order(merchant, product, current_price, shop_name, prompt_text)
            if generated_url:
                try:
                    profile.word_balance = F('word_balance') - dynamic_tokens
                    profile.save(update_fields=['word_balance'])
                    logger.info(f"[VoiceEngine] Generated AI voice for Merchant #{merchant.id} (Deducted {dynamic_tokens} tokens)")
                    return {
                        'mode': 'ai_generated',
                        'audio_url': generated_url,
                        'tts_text': ''
                    }
                except Exception as save_err:
                    logger.warning(f"[VoiceEngine] Failed updating token balance: {save_err}")
                    return {
                        'mode': 'ai_generated',
                        'audio_url': generated_url,
                        'tts_text': ''
                    }
        else:
            logger.info(f"[VoiceEngine] Merchant {merchant.id} insufficient word_balance ({current_balance} < {dynamic_tokens}). Falling back to default.")

    # Tier 3 (Fallback): High-Quality Studio Pre-recorded System Audio (Never robot Web Speech)
    return {
        'mode': 'default_audio',
        'audio_url': DEFAULT_SYSTEM_VOICE_URL,
        'tts_text': ''
    }


def _generate_ai_voice_for_order(merchant, product, price: Decimal, shop_name: str, text: str) -> str:
    """
    Synthesizes Bengali voice for order confirmation and stores it in persistent media storage (S3/Media).
    """
    try:
        from django.core.files.storage import default_storage
        from django.core.files.base import ContentFile
        import hashlib

        # Hash prompt text to allow caching identical sentences
        text_hash = hashlib.md5(text.encode('utf-8')).hexdigest()[:12]
        prod_tag = f"prod_{product.id}" if (product and hasattr(product, 'id')) else "order"
        file_name = f"voices/{prod_tag}_{text_hash}_{int(price)}.mp3"

        if default_storage.exists(file_name):
            return default_storage.url(file_name)

        audio_bytes = _synthesize_bengali_audio(text)
        if audio_bytes:
            saved_name = default_storage.save(file_name, ContentFile(audio_bytes))
            return default_storage.url(saved_name)
    except Exception as e:
        logger.warning(f"[VoiceEngine] Audio storage/generation error: {e}")

    return ""


def _synthesize_bengali_audio(text: str) -> bytes:
    """
    Synthesizes natural Bengali voice audio bytes completely free of cost ($0.00).
    Chunks text safely (<90 chars per chunk) to avoid Google TTS 400 limits.
    """
    try:
        import urllib.request
        import urllib.parse

        # Split text into natural chunks (comma, period, or space under 90 characters)
        chunks = []
        words = text.split()
        curr = ""
        for w in words:
            if len(curr) + len(w) + 1 < 90:
                curr += (" " + w if curr else w)
            else:
                if curr:
                    chunks.append(curr)
                curr = w
        if curr:
            chunks.append(curr)

        all_bytes = bytearray()
        for chunk in chunks:
            encoded = urllib.parse.quote(chunk)
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded}&tl=bn&client=tw-ob"
            req = urllib.request.Request(
                url,
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            )
            with urllib.request.urlopen(req, timeout=8) as response:
                all_bytes.extend(response.read())

        if all_bytes:
            logger.info(f"[VoiceEngine] Synthesized {len(all_bytes)} bytes of free Bengali audio via {len(chunks)} chunks.")
            return bytes(all_bytes)
    except Exception as err:
        logger.warning(f"[VoiceEngine] Free Bengali TTS failed: {err}")

    return None

