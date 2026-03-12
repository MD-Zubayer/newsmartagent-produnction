import redis
import numpy as np

# Redis Connection Settings (Match your environment)
REDIS_HOST = 'newsmartagent-redis'
REDIS_PORT = 6379
REDIS_DB = 0

def create_index():
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB)
    
    index_name = "idx:embeddings"
    
    try:
        # Check if index exists
        print(f"🔍 Checking if index '{index_name}' exists...")
        r.execute_command("FT.INFO", index_name)
        print(f"✅ Index '{index_name}' already exists.")
    except redis.exceptions.ResponseError as e:
        if "Unknown index name" in str(e):
            print(f"🚀 Creating RediSearch index: {index_name}")
            # FT.CREATE idx:embeddings ON HASH PREFIX 1 emb: SCHEMA page_id TAG text TEXT embedding VECTOR HNSW 6 TYPE FLOAT32 DIM 768 DISTANCE_METRIC COSINE
            r.execute_command(
                "FT.CREATE", index_name,
                "ON", "HASH",
                "PREFIX", 1, "emb:",
                "SCHEMA",
                "page_id", "TAG",
                "text", "TEXT",
                "embedding", "VECTOR", "HNSW", 6,
                "TYPE", "FLOAT32",
                "DIM", 768,
                "DISTANCE_METRIC", "COSINE"
            )
            print(f"✅ Index '{index_name}' created successfully.")
        else:
            print(f"❌ Error checking index: {e}")
    except redis.exceptions.ConnectionError:
        print(f"❌ Could not connect to Redis at {REDIS_HOST}:{REDIS_PORT}. Ensure you are running this inside the docker network or have port forwarding set up.")

if __name__ == "__main__":
    create_index()
