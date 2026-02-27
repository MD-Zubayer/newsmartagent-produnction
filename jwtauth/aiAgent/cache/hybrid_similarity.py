# aiAgent/cache/hybrid_similarity.py
import hashlib
from aiAgent.cache.ranking import incr_message_frequency
import json
import redis
from .utils import normalize_text
import difflib

r = redis.Redis(host='newsmartagent-redis', port=6379, db=2)

def get_cached_reply(agent_id, msg_text):
    normalized = normalize_text(msg_text)
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    key = f"agent:{agent_id}:reply:{msg_hash}"

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
    
    
def fuzzy_match(agent_id, msg_text, threshold=0.85):
    normalized = normalize_text(msg_text)
    cache_keys = r.keys(f"agent:{agent_id}:reply")

    for key in cache_keys:
        stored_hash = key.decode().split(":")[-1]
        cached = r.get(key)
        if not cached:
            continue
        
        stored_data = json.loads(cached)
        # reverse hash match possible না, তাই normalized text store করলে ভালো
        # আপাতত শুধু similarity ratio
        ratio = difflib.SequenceMatcher(None, normalized, normalized).ratio()

        if ratio >= threshold:
            incr_message_frequency(agent_id, stored_hash)
            return stored_data
    
    return None
        