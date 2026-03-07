# aiAgent/cache/client.py
import redis

# Connection Pool ব্যবহার করলে কানেকশন রিসাইকেল হয়, পারফরম্যান্স বাড়ে
pool = redis.ConnectionPool(host='newsmartagent-redis', port=6379, decode_responses=False)

def get_redis_client(db=0):
    return redis.Redis(connection_pool=pool, db=db)