# aiAgent/cache/metrics.py
import redis
from aiAgent.cache.client import get_redis_client


r = get_redis_client(db=3)  # DB 3 for metrics

def incr_counter(agent_id, field, value=1):
    key = f"agent:{agent_id}:metrics"
    r.hincrby(key, field, value)

def get_metrics(agent_id):
    key = f"agent:{agent_id}:metrics"
    return r.hgetall(key)

    