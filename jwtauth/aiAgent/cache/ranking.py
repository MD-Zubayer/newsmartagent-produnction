# aiAgent/cache/ranking.py
import redis
import hashlib
import json

r = redis.Redis(host='newsmartagent-redis', port=6379, db=6)

def incr_message_frequency(agent_id, msg_hash):
    key = f"agent:{agent_id}:ranking"
    r.zincrby(key, 1, msg_hash)

def get_top_message(agent_id, top_n=10):
    key = f"agent:{agent_id}:ranking"
    return r.zrevrange(key, 0, top_n-1, withscores=True)

