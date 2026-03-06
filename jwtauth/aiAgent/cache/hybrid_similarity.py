# aiAgent/cache/hybrid_similarity.py
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


r = get_redis_client(db=2) # DB 2 for clusters


def get_cached_reply(agent_id, msg_text=None, msg_hash=None):                
    """
    মেসেজ টেক্সট অথবা হাশ (hash) দিয়ে ক্যাশ খুঁজে আনে।
    """
    if msg_hash:
        # ⚡ যদি হাশ সরাসরি পাওয়া যায় (যেমন ক্লাস্টার থেকে)
        key = f"agent:{agent_id}:reply:{msg_hash}"
    elif msg_text:
        # ⚡ যদি টেক্সট পাওয়া যায় (পুরানো লজিক)
        normalized = normalize_text(msg_text)
        msg_hash = hashlib.md5(normalized.encode()).hexdigest()
        key = f"agent:{agent_id}:reply:{msg_hash}"
    else:
        return None

    cached = r.get(key)
    if cached:
        incr_message_frequency(agent_id, msg_hash)
        return json.loads(cached)

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
    
    
def fuzzy_match(agent_id, msg_text, threshold=75): # ⚡ RapidFuzz সাধারণত ০-১০০ স্কেলে কাজ করে
    normalized_input = normalize_text(msg_text)
    
    # ১. ওই এজেন্টের সব ক্যাশ কি (keys) নিয়ে আসা
    pattern = f"agent:{agent_id}:reply:*"
    cache_keys = r.keys(pattern)
    print(f"--- [DEBUG] Fuzzy Matching for: {normalized_input} ---") # সরাসরি প্রিন্ট লগে দেখার জন্য
    if not cache_keys:
        print("--- [DEBUG] No cache keys found in Redis db=2 ---")
        return None

    best_score = 0
    best_data = None
    best_hash = None

    # ২. সব ক্যাশ করা মেসেজের সাথে তুলনা করা
    for key in cache_keys:
        cached_raw = r.get(key)
        if not cached_raw:
            continue
            
        stored_data = json.loads(cached_raw)
        stored_text = stored_data.get('original_normalized', '')
        
        # ⚡ RapidFuzz Token Sort Ratio ব্যবহার করা ভালো (শব্দ উল্টাপাল্টা হলেও ধরে ফেলে)
        score = fuzz.token_sort_ratio(normalized_input, stored_text)
        print(f"--- [DEBUG] Comparing with: '{stored_text}' | Score: {score} ---")
        if score > best_score and score >= threshold:
            best_score = score
            best_data = stored_data
            best_hash = key.decode().split(":")[-1]

    if best_data:
        # ৩. যদি মিল পাওয়া যায়, তবে র‍্যাঙ্কিং আপডেট করো
        incr_message_frequency(agent_id, best_hash)
        logger.info(f"⚡ RapidFuzz Match Found! Score: {best_score}%")
        print(f"--- [DEBUG] MATCH FOUND! Score: {best_score} ---")
        return best_data

    return None


TRANSLATION_MAP = {
    "সালাম": "assalamualaikum",
    "ভাই": "brother",
    "দাম": "price",
    # ... আরো যোগ করুন
}

def normalize_with_map(text):
    normalized = normalize_text(text)
    # ম্যাপ ব্যবহার করে শব্দ ট্রান্সলেট করুন (নেটওয়ার্ক কল ছাড়া)
    for bn, en in TRANSLATION_MAP.items():
        normalized = normalized.replace(bn, en)
    return normalized


def find_best_cached_hash(agent_id, msg_text, threshold=70):                
    # 1. সব key নাও
    pattern = f"agent:{agent_id}:reply:*"                
    keys = r.keys(pattern)                
    
    best_hash = None                
    highest_score = 0                
    
    for key in keys:                
        data = json.loads(r.get(key))                
        cached_text = data.get("original_text")                
        
        if not cached_text: continue                
        
        # 2. স্কোর চেক
        score = fuzz.ratio(msg_text, cached_text)                
        if score > highest_score and score >= threshold:                
            highest_score = score                
            key_str = key.decode() if isinstance(key, bytes) else key
            best_hash = key_str.split(':')[-1]
            
    return best_hash   