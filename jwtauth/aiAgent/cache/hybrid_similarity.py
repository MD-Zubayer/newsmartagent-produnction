# aiAgent/cache/hybrid_similarity.py
import re
import hashlib
from aiAgent.cache.ranking import incr_message_frequency
import json
import redis
from .utils import normalize_text
from rapidfuzz import fuzz, process
from celery.signals import after_setup_logger, after_setup_task_logger
import logging
import logging.config
from django.conf import settings
from aiAgent.cache.client import get_redis_client




@after_setup_logger.connect
@after_setup_task_logger.connect
def setup_celery_logging(logger, **kwargs):
    # সেলেরিকে বাধ্য করা হচ্ছে Django-র LOGGING সেটিংস ব্যবহার করতে
    logging.config.dictConfig(settings.LOGGING)
    
logger = logging.getLogger(__name__)


r = get_redis_client(db=2)  # DB 2 for agent-specific cache
r_grouped = get_redis_client(db=6)  # DB 6 for grouped cache (global + sender)


def get_cached_reply(agent_id, msg_text=None, msg_hash=None):                
    if msg_hash:
        key = f"agent:{agent_id}:reply:{msg_hash}"
    elif msg_text:
        normalized = normalize_text(msg_text)
        msg_hash = hashlib.md5(normalized.encode()).hexdigest()
        key = f"agent:{agent_id}:reply:{msg_hash}"
    else:
        return None

    try:
        cached = r.get(key)
        if cached:
            incr_message_frequency(agent_id, msg_hash)
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Redis Cache Error: {e}")
        return None # ক্যাশ এরর হলে সরাসরি AI কল করার সুযোগ থাকবে

    return None


def set_cached_reply(agent_id, msg_text, reply, model, input_tokens=0, output_tokens=0, ttl=86400):
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"agent:{agent_id}:reply:{msg_hash}"

    r.set(key, json.dumps({
        "reply": reply,
        "model": model,
        "original_text": msg_text,
        "original_normalized": normalized,
        "input_tokens": input_tokens,    # ⚡ নতুন ডাটা
        "output_tokens": output_tokens   # ⚡ নতুন ডাটা
    }), ex=ttl)

    incr_message_frequency(agent_id, msg_hash)
    
    
def fuzzy_match(agent_id, msg_text, threshold=85): # ⚡ RapidFuzz সাধারণত ০-১০০ স্কেলে কাজ করে
    normalized_input = normalize_text(msg_text)
    
    # ১. r.keys() এর বদলে r.scan_iter() ব্যবহার করা হয়েছে (Non-blocking approach)
    pattern = f"agent:{agent_id}:reply:*"
    
    # scan_iter একটি জেনারেটর রিটার্ন করে যা মেমোরি সাশ্রয়ী
    cache_keys = r.scan_iter(match=pattern, count=100) 
    
    logger.debug(f"Fuzzy Matching for: {normalized_input}") # সরাসরি প্রিন্ট লগে দেখার জন্য
    
    best_score = 0
    best_data = None
    best_hash = None
    found_any = False # চেক করার জন্য যে কোনো কী পাওয়া গেল কি না

    # ২. সব ক্যাশ করা মেসেজের সাথে তুলনা করা
    for key in cache_keys:
        found_any = True
        cached_raw = r.get(key)
        if not cached_raw:
            continue
            
        stored_data = json.loads(cached_raw)
        stored_text = stored_data.get('original_normalized', '')
        
        # ⚡ RapidFuzz Token Sort Ratio ব্যবহার করা ভালো (শব্দ উল্টাপাল্টা হলেও ধরে ফেলে)
        score = fuzz.token_sort_ratio(normalized_input, stored_text)
        logger.debug(f"Comparing with: '{stored_text}' | Score: {score}")
        
        if score > best_score and score >= threshold:
            best_score = score
            best_data = stored_data
            # key যদি bytes হয় তবে decode করে হাশ আলাদা করা হচ্ছে
            key_str = key.decode() if isinstance(key, bytes) else key
            best_hash = key_str.split(":")[-1]

    # যদি স্ক্যান করার পর কোনো কী-ই না পাওয়া যায়
    if not found_any:
        logger.debug(f"No cache keys in Redis DB2 for agent {agent_id}")
        return None

    if best_data:
        # ৩. যদি মিল পাওয়া যায়, তবে র‍্যাঙ্কিং আপডেট করো
        incr_message_frequency(agent_id, best_hash)
        logger.info(f"⚡ Fuzzy Match! Score: {best_score}% | '{msg_text[:20]}'")
        return best_data

    return None


TRANSLATION_MAP = {
    "আসসালামু আলাইকুম": "assalamualaikum",
    "সালাম": "assalamualaikum",
    "ভাই": "brother",
    "দাম কত": "price",
    "দাম": "price",
    "koto": "price", # বাংলিশ সাপোর্ট
    "dam": "price",
}

def get_optimized_pattern(mapping):
    # ১. কি (keys) গুলোকে বড় থেকে ছোট হিসেবে সাজানো (যাতে 'দাম কত' আগে রিপ্লেস হয়)
    sorted_keys = sorted(mapping.keys(), key=len, reverse=True)
    
    # ২. শক্তিশালী প্যাটার্ন (এটি বাংলা এবং ইংরেজি উভয়ের জন্য কাজ করবে)
    # এটি নিশ্চিত করে যে শব্দের আগে ও পরে কোনো আলফানিউমেরিক ক্যারেক্টার নেই
    pattern_string = r'(?<!\w)(' + '|'.join(re.escape(key) for key in sorted_keys) + r')(?!\w)'
    
    return re.compile(pattern_string, re.IGNORECASE | re.UNICODE)

# প্যাটার্নটি একবার গ্লোবালি জেনারেট করে রাখা ভালো (পারফরম্যান্সের জন্য)
TRANSLATION_PATTERN = get_optimized_pattern(TRANSLATION_MAP)

def normalize_with_map(text):
    if not text:
        return ""

    # ৩. রিপ্লেসমেন্ট লজিক
    def replace_logic(match):
        matched_text = match.group(0)
        # প্রথমে হুবহু মিলে কি না চেক করবে, না মিললে ছোট হাতের অক্ষরে চেক করবে
        return TRANSLATION_MAP.get(matched_text, 
               TRANSLATION_MAP.get(matched_text.lower(), matched_text))

    # মূল টেক্সট রিপ্লেস করা
    return TRANSLATION_PATTERN.sub(replace_logic, text)


def find_best_cached_hash(agent_id, msg_text, threshold=70):                
    # ১. r.keys() এর বদলে r.scan_iter() ব্যবহার (নিরাপদ উপায়)
    pattern = f"agent:{agent_id}:reply:*"                
    keys = r.scan_iter(match=pattern, count=100)                
    
    best_hash = None                
    highest_score = 0
    normalized_input = normalize_text(msg_text)
    
    for key in keys:                
        raw_data = r.get(key)
        if not raw_data: continue
        
        data = json.loads(raw_data)                
        cached_text = data.get("original_normalized", data.get("original_text", ""))                
        
        if not cached_text: continue                
        
        # token_sort_ratio — fuzzy_match এর সাথে সামঞ্জস্য রাখতে
        score = fuzz.token_sort_ratio(normalized_input, cached_text)                
        if score > highest_score and score >= threshold:                
            highest_score = score                
            key_str = key.decode() if isinstance(key, bytes) else key
            best_hash = key_str.split(':')[-1]
            
    return best_hash


# ==================== GLOBAL CACHE (DB 6) ==================== #

GLOBAL_CACHE_TTL = 86400 * 30   # ৩০ দিন
AGENT_CACHE_TTL  = 86400 * 14   # ১৪ দিন (agent-specific grouped)
SENDER_CACHE_TTL = 86400 * 7    # ৭ দিন


def get_global_cached_reply(msg_text):
    """Global cache থেকে exact match করে reply নিয়ে আসে।"""
    if not msg_text:
        return None
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"global:reply:{msg_hash}"
    try:
        cached = r_grouped.get(key)
        if cached:
            logger.info(f"⚡ GLOBAL EXACT HIT: '{msg_text[:30]}'")
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Global Cache Get Error: {e}")
    return None


def set_global_cached_reply(msg_text, reply, model, input_tokens=0, output_tokens=0, ttl=GLOBAL_CACHE_TTL):
    """AI reply-কে global cache-এ save করে।"""
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"global:reply:{msg_hash}"
    try:
        r_grouped.set(key, json.dumps({
            "reply": reply,
            "model": model,
            "original_text": msg_text,
            "original_normalized": normalized,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_scope": "global",
        }), ex=ttl)
        logger.info(f"✅ Global cache saved: '{msg_text[:30]}'")
    except Exception as e:
        logger.error(f"Global Cache Set Error: {e}")


def global_fuzzy_match(msg_text, threshold=92):
    """
    Global cache-এ fuzzy search করে। Global entries সবার জন্য
    প্রযোজ্য তাই threshold বেশি রাখা হয়েছে (92)।
    """
    if not msg_text:
        return None
    normalized_input = normalize_text(msg_text)
    pattern = "global:reply:*"
    best_score = 0
    best_data = None
    found_any = False
    try:
        for key in r_grouped.scan_iter(match=pattern, count=100):
            found_any = True
            cached_raw = r_grouped.get(key)
            if not cached_raw:
                continue
            stored_data = json.loads(cached_raw)
            stored_text = stored_data.get('original_normalized', '')
            score = fuzz.token_sort_ratio(normalized_input, stored_text)
            if score > best_score and score >= threshold:
                best_score = score
                best_data = stored_data
    except Exception as e:
        logger.error(f"Global Fuzzy Match Error: {e}")
        return None

    if not found_any:
        logger.debug("No global cache keys in Redis DB6.")
        return None
    if best_data:
        logger.info(f"⚡ GLOBAL FUZZY HIT! Score: {best_score}% | '{msg_text[:20]}'")
        return best_data
    return None


# ==================== SENDER-SPECIFIC CACHE (DB 6) ==================== #

def get_sender_cached_reply(agent_id, sender_id, msg_text):
    """নির্দিষ্ট agent ও sender-এর জন্য exact cache lookup।"""
    if not msg_text:
        return None
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"agent:{agent_id}:sender:{sender_id}:reply:{msg_hash}"
    try:
        cached = r_grouped.get(key)
        if cached:
            logger.info(f"⚡ SENDER EXACT HIT for sender {sender_id}: '{msg_text[:30]}'")
            return json.loads(cached)
    except Exception as e:
        logger.error(f"Sender Cache Get Error: {e}")
    return None


def set_sender_cached_reply(agent_id, sender_id, msg_text, reply, model, input_tokens=0, output_tokens=0, ttl=SENDER_CACHE_TTL):
    """AI reply-কে sender-specific cache-এ save করে।"""
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"agent:{agent_id}:sender:{sender_id}:reply:{msg_hash}"
    try:
        r_grouped.set(key, json.dumps({
            "reply": reply,
            "model": model,
            "original_text": msg_text,
            "original_normalized": normalized,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cache_scope": "sender_specific",
        }), ex=ttl)
        logger.info(f"✅ Sender cache saved for {sender_id}: '{msg_text[:30]}'")
    except Exception as e:
        logger.error(f"Sender Cache Set Error: {e}")