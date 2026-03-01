# /app/chat/utils.py

from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from webhooks.utils import fetch_facebook_post_text
import logging

logger = logging.getLogger(__name__)


def send_user_notification(instance):
    from chat.serializer import NotificationSerializer

  
    
    
    # ৩. চ্যানেলে ব্রডকাস্টিং
    channel_layer = get_channel_layer()
    serializer = NotificationSerializer(instance)

    async_to_sync(channel_layer.group_send)(
        f"user_{instance.user.id}",
        {
            "type": "send_notification",
            "content": serializer.data
        }
    )
    
    
# def generate_post_summary_ai(raw_text):
#     try:
#         from aiAgent.gemini import generate_quick_summary
        
#         prompt = f"""Summarize the following Facebook post in maximum 3 short sentences.
#                 Rules:
#                 - Keep all key points.
#                 - Keep total length under 60-80 words.
#                 - No opinion.
#                 - No extra explanation.
#                 - Simple and clear language.
#                 Post: {raw_text}"""

#         response = generate_quick_summary(prompt)

#         if isinstance(response, dict) and response.get('status') == 'success':
#             return response.get('reply')
#         return None
#     except Exception as e:
#         logger.error(f"Summary AI Error: {e}")
#         return None
        
    
def get_smart_post_context(post_id, access_token):
    from .models import PostCache
    from aiAgent.gemini import generate_quick_summary
    
    # check db
    cached_post = PostCache.objects.filter(post_id=post_id).first()
    if  cached_post:
        return cached_post.summary
    
    
    # ২. যদি ডিবিতে না থাকে (অর্থাৎ এই পোস্টে প্রথম কমেন্ট), তবেই নিচের কাজগুলো হবে
    logger.info(f"🔍 Summary not in Cache. Fetching from FB for post: {post_id}")
    raw_text = fetch_facebook_post_text(post_id, access_token)
    if not raw_text:
        return ""
    
    ai_summary = generate_quick_summary(raw_text)

    if ai_summary and len(ai_summary) > 30:
        try:
            
            PostCache.objects.create(post_id=post_id, summary=ai_summary)
            logger.info(f"💾 Successfully cached new summary for post: {post_id}")
            return ai_summary
        except Exception as e:
            logger.error(f"❌ Error saving PostCache: {e}")
            return ai_summary

    logger.warning(f"⚠️ Summary failed for post {post_id}. Not saving to cache.")
    return raw_text[:300]
    
    