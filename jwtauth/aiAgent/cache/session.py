# aiAgent/cache/session.py
import redis
import json
r = redis.Redis(host='newsmartagent-redis', port=6379, db=5)  # DB 5 for session

def set_session(agent_id, sender_id, data, ttl=1800):
    key = f"agent:{agent_id}:user:{sender_id}:session"
    r.set(key, json.dumps(data), ex=ttl)

def get_session(agent_id, sender_id):
    key = f"agent:{agent_id}:user:{sender_id}:session"
    data = r.get(key)
    return json.loads(data) if data else {}