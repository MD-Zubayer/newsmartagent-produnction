"""
Facebook Public Comment Reply — Direct Graph API (n8n-মুক্ত)

পূর্বে n8n webhook-এ পাঠানো হত। এখন সরাসরি MetaService-এর মাধ্যমে
Facebook Graph API-তে public comment reply করা হয়।
"""

from integrations.services.meta import MetaService
import logging

logger = logging.getLogger('aiAgent')


def deliver_public_comment_reply(comment_id, reply_text, page_access_token):
    """কমেন্টের নিচেই পাবলিক রিপ্লাই দেওয়ার জন্য সরাসরি Graph API ব্যবহার।"""
    try:
        success = MetaService.send_comment_reply(
            access_token=page_access_token,
            comment_id=str(comment_id),
            message_text=str(reply_text),
        )
        if success:
            logger.info(f"✅ [Comment] Replied to comment {comment_id}")
        else:
            logger.error(f"❌ [Comment] Failed to reply to comment {comment_id}")
        return success
    except Exception as e:
        logger.error(f"❌ [Comment] Public reply failed: {e}")
        return False