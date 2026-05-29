# aiAgent/cache/client.py
import os
import redis

REDIS_URL = os.environ.get('REDIS_URL')
REDIS_HOST = os.environ.get('REDIS_HOST', 'production-redis')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

# Connection Pool — কানেকশন রিসাইকেল হয়, পারফরম্যান্স বাড়ে
if REDIS_URL:
    pool = redis.ConnectionPool.from_url(
        REDIS_URL,
        decode_responses=False,
        health_check_interval=30,
        retry_on_timeout=True
    )
else:
    pool = redis.ConnectionPool(
        host=REDIS_HOST,
        port=REDIS_PORT,
        decode_responses=False,
        health_check_interval=30,
        retry_on_timeout=True
    )

def get_redis_client(db=0):
    return redis.Redis(connection_pool=pool, db=db)