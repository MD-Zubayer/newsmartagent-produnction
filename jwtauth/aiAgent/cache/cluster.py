# aiAgent/cache/cluster.py
import redis
import hashlib
import json
from .utils import normalize_text
from aiAgent.cache.client import get_redis_client



r = get_redis_client(db=4) # DB 4 for clusters

def get_cluster_map(agent_id):
    key = f"agent:{agent_id}:clusters"
    return {
        k.decode(): v.decode()
        for k, v in r.hgetall(key).items()
    }

def assign_to_cluster(agent_id, msg_text, cluster_id):
    normalized = normalize_text(msg_text)
    key = f"agent:{agent_id}:clusters"
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    r.hset(key, msg_hash, cluster_id)
    
    
