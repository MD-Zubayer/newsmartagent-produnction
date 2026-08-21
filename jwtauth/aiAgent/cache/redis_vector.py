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
                "msg_hash", "TAG",      # ⚡ নতুন যোগ করা হয়েছে (লিঙ্কিং এর জন্য)
                "text", "TEXT",
                "embedding", "VECTOR", "HNSW", 12,
                "TYPE", "FLOAT32",
                "DIM", 768,
                "DISTANCE_METRIC", "COSINE",
                "INITIAL_CAP", 1000, 
                "M", 16, 
                "EF_CONSTRUCTION", 200
            )
            print("✅ Index created with Reference support.")
        else:
            raise e

def save_vector_embedding(agent_id, text, msg_hash, embedding_vector):
    """
    র‍্যাম বাঁচাতে আমরা শুধু হাশ রাখি, উত্তরটি নয়।
    """
    ensure_index_exists()
    
    # ভেক্টরকে বাইনারি ফরম্যাটে রূপান্তর ( FLOAT32 মাস্ট )
    vec_bytes = np.array(embedding_vector, dtype=np.float32).tobytes()
    
    # ইউনিক কী তৈরি (এজেন্ট আইডি ও হাশ দিয়ে)
    key = f"emb:{agent_id}:{msg_hash}"
    
    r.hset(key, mapping={
        "page_id": str(agent_id),
        "msg_hash": str(msg_hash), # ⚡ এটি DB 2 থেকে উত্তর আনার চাবিকাঠি
        "text": text,
        "embedding": vec_bytes
    })
    
    # ৩০ দিন পর অটো ডিলিট (র‍্যাম ক্লিয়ার রাখতে)
    r.expire(key, 86400 * 30) 
    print(f"✅ Saved vector for agent {agent_id}, hash {msg_hash}")



# -------------------- Vector Search -------------------- #


def search_similar_vectors(agent_id, query_vector, top_k=3):
    ensure_index_exists()
    vec_bytes = np.array(query_vector, dtype=np.float32).tobytes()
    
    # KNN কোয়েরি: এটি ভেক্টরের দিক থেকে সবচেয়ে কাছের ৩টি উত্তর খুঁজবে
    query = f'(@page_id:{{{agent_id}}})=>[KNN {top_k} @embedding $vec AS vector_score]'
    
    try:
        res = r.execute_command(
            "FT.SEARCH", "idx:embeddings",
            query,
            "PARAMS", 2, "vec", vec_bytes,
            "RETURN", 3, "text", "msg_hash", "vector_score", # ⚡ ৩টি ফিল্ড রিটার্ন চাওয়া হচ্ছে
            "SORTBY", "vector_score", "ASC",
            "DIALECT", 2
        )

        results = []
        
        # 1. If res is a dictionary (newer redis-py parsing format)
        if isinstance(res, dict):
            results_list = res.get(b'results') or res.get('results') or []
            for doc in results_list:
                doc_fields = doc.get(b'extra_attributes') or doc.get('extra_attributes') or {}
                data = {
                    (k.decode() if isinstance(k, bytes) else k):
                    (v.decode() if isinstance(v, bytes) else v)
                    for k, v in doc_fields.items()
                }
                results.append({
                    "text": data.get("text"),
                    "msg_hash": data.get("msg_hash"),
                    "score": float(data.get("vector_score", 1.0))
                })
            return results

        # 2. If res is a list/tuple (raw Redis response format)
        if isinstance(res, (list, tuple)):
            if not res or res[0] == 0:
                return []
            for i in range(1, len(res), 2):
                doc_fields = res[i+1]
                if isinstance(doc_fields, dict):
                    data = {
                        (k.decode() if isinstance(k, bytes) else k):
                        (v.decode() if isinstance(v, bytes) else v)
                        for k, v in doc_fields.items()
                    }
                elif isinstance(doc_fields, (list, tuple)):
                    data = {
                        (doc_fields[j].decode() if isinstance(doc_fields[j], bytes) else doc_fields[j]): 
                        (doc_fields[j+1].decode() if isinstance(doc_fields[j+1], bytes) else doc_fields[j+1])
                        for j in range(0, len(doc_fields), 2)
                    }
                else:
                    data = {}
                results.append({
                    "text": data.get("text"),
                    "msg_hash": data.get("msg_hash"),
                    "score": float(data.get("vector_score", 1.0))
                })
            return results

        return []
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Search Error: {e}")
        return []
