# aiAgent/cache/cluster.py
import redis
import hashlib
import json
from .utils import normalize_text

r = redis.Redis(host='newsmartagent-redis', port=6379, db=4)  # DB 4 for clusters

def get_cluster_map(agent_id):
    key = f"agent:{agent_id}:clusters"
    data = r.get(key)
    return json.loads(data) if data else {}


def assign_to_cluster(agent_id, msg_text, cluster_id):
    normalized = normalize_text(msg_text)
    key = f"agent:{agent_id}:clusters"
    msg_hash = hashlib.md5(normalized.encode()).hexdigest()
    r.hset(key, msg_hash, cluster_id)