# webhooks/utils.py
import requests
import logging

logger = logging.getLogger(__name__)

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