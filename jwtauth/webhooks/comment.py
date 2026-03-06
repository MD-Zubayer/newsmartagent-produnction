import requests
def deliver_public_comment_reply(comment_id, reply_text, page_access_token):
    """কমেন্টের নিচেই পাবলিক রিপ্লাই দেওয়ার জন্য n8n-এ পাঠানো"""
    webhook_url = "https://n8n.newsmartagent.com/webhook/fb-public-comment-delivery"
    
    payload = {
        "comment_id": str(comment_id),
        "message": str(reply_text), # যেমন: "ইনবক্স চেক করুন প্রিয়"
        "page_access_token": str(page_access_token)
    }

    try:
        requests.post(webhook_url, json=payload, timeout=10)
        print(f"✅ Replied to comment {comment_id}")
        return True
    except Exception as e:
        print(f"Public reply failed: {e}")
        return False