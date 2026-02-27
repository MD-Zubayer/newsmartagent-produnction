# webhooks/utils.py
import requests
import logging
import hashlib
import redis
import json
logger = logging.getLogger(__name__)
r = redis.Redis(host='newsmartagent-redis', port=6379, db=1)



def fetch_facebook_post_text(post_id, access_token):
    
    if not post_id or not access_token:
        return ""

    try:
        url = f"https://graph.facebook.com/v21.0/{post_id}"
        params = {
            'fields': 'message',
            'access_token': access_token
        }
        
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()

        return data.get('message', '')
    except Exception as e:
        logger.error(f"Error fetching FB post data: {e}")
        return ""
    
def get_message_cache(page_id, text):
    """
    একই পেজের জন্য একই মেসেজ ক্যাশে আছে কি না তা চেক করবে।
    """
    # মেসেজ থেকে স্পেস কমিয়ে এবং ছোট হাতের অক্ষর করে হ্যাশ তৈরি (Exact Match)
    clean_text = text.lower().strip()
    query_hash = hashlib.md5(clean_text.encode()).hexdigest()
    cache_key = f"ai_cache:{page_id}:{query_hash}"

    cached_data = r.get(cache_key)

    if cached_data:
        return json.loads(cached_data)
    return None

def set_message_cache(page_id, text, reply_data, timeout=3600):
    """
    AI এর উত্তরটি ১ ঘণ্টার জন্য ক্যাশ করে রাখবে।
    """
    clean_text = text.lower().strip()
    query_hash = hashlib.md5(clean_text.encode()).hexdigest()
    cache_key = f"ai_cache:{page_id}:{query_hash}"
    r.set(cache_key, json.dumps(reply_data), ex=timeout)
    
    