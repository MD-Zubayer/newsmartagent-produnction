# aiAgent/cache/session.py
import redis
import json
from aiAgent.cache.client import get_redis_client


r = get_redis_client(db=5)  # DB 5 for session

def set_session(agent_id, sender_id, data, ttl=1800):
    key = f"agent:{agent_id}:user:{sender_id}:session"
    r.set(key, json.dumps(data), ex=ttl)

def get_session(agent_id, sender_id):
    key = f"agent:{agent_id}:user:{sender_id}:session"
    data = r.get(key)
    return json.loads(data) if data else {}