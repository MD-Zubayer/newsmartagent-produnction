import redis
import hashlib
import json
import logging
from .hybrid_similarity import normalize_for_cache
from aiAgent.cache.client import get_redis_client

logger = logging.getLogger(__name__)
r = get_redis_client(db=4)

CLUSTER_TTL = 60 * 60 * 24 * 30 # ৩০ দিন

def get_cluster_map(agent_id):
    """এজেন্টের ক্লাস্টার ডাটা ডিকশনারি আকারে নিয়ে আসে"""
    key = f"agent:{agent_id}:clusters"
    try:
        data = r.hgetall(key)
        return {k.decode('utf-8'): v.decode('utf-8') for k, v in data.items()}
    except Exception as e:
        logger.error(f"Error fetching cluster map: {e}")
        return {}

def assign_to_cluster(agent_id, msg_text, cluster_id):
    """মেসেজকে একটি ক্লাস্টারে ফেলে এবং মেয়াদ সেট করে"""
    normalized = normalize_for_cache(msg_text)
    key = f"agent:{agent_id}:clusters"
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    
    try:
        pipe = r.pipeline()
        pipe.hset(key, msg_hash, cluster_id)
        pipe.expire(key, CLUSTER_TTL) # ডেটা রিফ্রেশ রাখা
        pipe.execute()
    except Exception as e:
        logger.error(f"Error assigning to cluster: {e}")
