import redis
import logging
from aiAgent.cache.client import get_redis_client

logger = logging.getLogger(__name__)
r = get_redis_client(db=4) 

# ১ মাস (৩০ দিন) পর র‍্যাঙ্কিং ডেটা অটো ডিলিট হবে (সেকেন্ডে)
RANKING_TTL = 30 * 24 * 60 * 60 

def incr_message_frequency(agent_id, msg_hash):
    """মেসেজ কাউন্ট বাড়ায় এবং কী-এর মেয়াদ সেট করে"""
    key = f"agent:{agent_id}:ranking"
    try:
        # Pipeline ব্যবহার করে দুটি কমান্ড একবারে পাঠানো (Network efficiency)
        pipe = r.pipeline()
        pipe.zincrby(key, 1, msg_hash)
        pipe.expire(key, RANKING_TTL)
        pipe.execute()
    except Exception as e:
        logger.error(f"Error updating ranking for agent {agent_id}: {e}")

def get_top_message(agent_id, top_n=10):
    """সবচেয়ে বেশি আসা মেসেজগুলো ডিকোড করে রিটার্ন করে"""
    key = f"agent:{agent_id}:ranking"
    try:
        # zrevrange রিটার্ন করে [(b'hash', score), ...]
        top_messages = r.zrevrange(key, 0, top_n-1, withscores=True)
        
        # বাইটস থেকে স্ট্রিংয়ে কনভার্ট করা (Clean Output)
        return [
            (m[0].decode('utf-8') if isinstance(m[0], bytes) else m[0], m[1]) 
            for m in top_messages
        ]
    except Exception as e:
        logger.error(f"Error retrieving top messages for agent {agent_id}: {e}")
        return []