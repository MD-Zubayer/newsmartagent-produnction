import redis, uuid, numpy as np, hashlib, json
from rapidfuzz import fuzz
from aiAgent.cache.utils import normalize_text
from aiAgent.cache.client import get_redis_client

# -------------------- Redis Setup -------------------- #
r = get_redis_client(db=0)  # Vector DB
CACHE_DB = 2  # আপনার normal cache db
CLUSTER_DB = 4

# -------------------- Vector Embedding Save -------------------- #
def ensure_index_exists():
    try:
        r.execute_command("FT.INFO", "idx:embeddings")
    except redis.exceptions.ResponseError as e:
        if "Unknown index name" in str(e):
            print("🚀 Creating RediSearch index: idx:embeddings")
            r.execute_command(
                "FT.CREATE", "idx:embeddings",
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
            print("✅ Index idx:embeddings created successfully.")
        else:
            raise e

def save_vector_embedding(agent_id, text, embedding_vector):
    ensure_index_exists()
    vec_bytes = np.array(embedding_vector, dtype=np.float32).tobytes()
    key = f"emb:{uuid.uuid4()}"
    
    r.hset(key, mapping={
        "page_id": str(agent_id),
        "text": text,
        "embedding": vec_bytes
    })
    print(f"✅ Saved vector for agent {agent_id}, key {key}")

# -------------------- Vector Search -------------------- #
def search_similar_vectors(agent_id, query_vector, top_k=3):
    ensure_index_exists()
    vec_bytes = np.array(query_vector, dtype=np.float32).tobytes()
    query = f'(@page_id:{{{agent_id}}})=>[KNN {top_k} @embedding $vec AS vector_score]'
    
    print(f"\n--- [DEBUG] Vector Search Query ---\n{query[:100]}...")  # debug query
    try:
        res = r.execute_command(
            "FT.SEARCH", "idx:embeddings",
            query,
            "PARAMS", 2, "vec", vec_bytes,
            "RETURN", 2, "text", "vector_score",
            "SORTBY", "vector_score", "ASC",
            "DIALECT", 2
        )
        print(f"[DEBUG] Raw search result: {res}")
        if res[0] == 0:
            print("[DEBUG] No results found.")
            return []

        results = []
        for i in range(1, len(res), 2):
            doc = res[i+1]
            data = dict(zip(doc[::2], doc[1::2]))
            results.append({
                "text": data.get("text"),
                "score": float(data.get("vector_score"))
            })
        print(f"[DEBUG] Processed top {top_k} results: {results}")
        return results
    except Exception as e:
        print(f"❌ Search Error: {e}")
        return []
