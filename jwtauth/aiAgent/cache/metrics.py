# aiAgent/cache/metrics.py
import redis

r = redis.Redis(host='newsmartagent-redis', port=6379, db=3)  # DB 3 for metrics

def incr_counter(agent_id, field, value=1):
    key = f"agent:{agent_id}:metrics"
    r.hincrby(key, field, value)

def get_metrics(agent_id):
    key = f"agent:{agent_id}:metrics"
    return r.hgetall(key)

    