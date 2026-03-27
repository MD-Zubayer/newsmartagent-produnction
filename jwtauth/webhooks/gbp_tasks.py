import requests
import logging
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from users.models import GoogleBusinessAccount, GoogleBusinessLocation, GBPReviewLog
from aiAgent.models import AgentAI

logger = logging.getLogger(__name__)

@shared_task(queue='youtube_queue') # Shared queue for Google-related tasks
def check_gbp_reviews():
    """
    Periodic task to check for new reviews on all active GBP locations.
    """
    active_locations = GoogleBusinessLocation.objects.filter(is_active=True)
    logger.info(f"🚀 [GBP Task] Starting check for {active_locations.count()} active locations.")
    
    for loc in active_locations:
        try:
            logger.info(f"🔍 [GBP Task] Checking location: {loc.location_name}")
            process_location_reviews(loc)
        except Exception as e:
            logger.error(f"❌ [GBP Task] Error processing location {loc.location_id}: {str(e)}")

def process_location_reviews(location):
    """
    Fetches and processes reviews for a single GBP location.
    """
    account = location.account
    access_token = account.access_token

    # 1. API Endpoint for reviews
    reviews_url = f"https://mybusiness.googleapis.com/v4/{location.location_id}/reviews"
    headers = {"Authorization": f"Bearer {access_token}"}
    
    response = requests.get(reviews_url, headers=headers)
    
    # 2. Handle Token Expiry
    if response.status_code == 401:
        logger.warning(f"🔑 [GBP Task] Token expired for {account.account_name}. Attempting refresh.")
        access_token = refresh_gbp_token(account)
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
            response = requests.get(reviews_url, headers=headers)
        else:
            logger.error(f"❌ [GBP Task] Failed to refresh token for {account.account_id}")
            return

    if response.status_code != 200:
        logger.error(f"❌ [GBP Task] API error for {location.location_id}: {response.text}")
        return

    data = response.json()
    reviews = data.get("reviews", [])
    logger.info(f"📝 [GBP Task] Found {len(reviews)} reviews for {location.location_name}")
    
    processed_count = 0
    skipped_count = 0
    
    for review in reviews:
        review_id = review.get("reviewId")
        reviewer = review.get("reviewer", {})
        reviewer_name = reviewer.get("displayName", "Anonymous")
        comment = review.get("comment", "")
        star_rating = review.get("starRating") # "ONE", "TWO", etc or numeric? (Docs say enum)
        
        # Check if already processed
        if GBPReviewLog.objects.filter(review_id=review_id).exists():
            skipped_count += 1
            continue
            
        # 3. Create Log Entry
        log_entry = GBPReviewLog.objects.create(
            location=location,
            review_id=review_id,
            reviewer_name=reviewer_name,
            review_text=comment,
            star_rating=convert_rating_to_int(star_rating),
            status='pending'
        )

        logger.info(f"✨ [GBP Task] New review by {reviewer_name}: {comment[:50]}...")

        # 4. Prepare payload for AI processing
        payload = {
            'platform': 'gbp',
            'sender_id': reviewer_name,
            'text': comment,
            'page_id': location.location_id,
            'message_id': review_id,
            'review_item': review,
            'location_db_id': location.id
        }
        
        from .tasks import process_ai_reply_task
        process_ai_reply_task.apply_async(kwargs={'data': payload}, queue='youtube_queue')
        processed_count += 1

    logger.info(f"📊 [GBP Task] Location {location.location_name} summary: Processed {processed_count}, Skipped {skipped_count}")

def refresh_gbp_token(account):
    """
    Refreshes the Google OAuth token for a GBP account.
    """
    if not account.refresh_token:
        return None
        
    url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": settings.YOUTUBE_CLIENT_ID,
        "client_secret": settings.YOUTUBE_CLIENT_SECRET,
        "refresh_token": account.refresh_token,
        "grant_type": "refresh_token"
    }
    
    resp = requests.post(url, data=data).json()
    new_access_token = resp.get("access_token")
    expires_in = resp.get("expires_in")
    
    if new_access_token:
        account.access_token = new_access_token
        if expires_in:
            account.token_expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
        account.save()
        
        # Also update AgentAI linked to this account's locations
        location_ids = list(account.locations.values_list('location_id', flat=True))
        AgentAI.objects.filter(page_id__in=location_ids, platform='gbp').update(
            access_token=new_access_token,
            token_expires_at=account.token_expires_at
        )
        return new_access_token
    return None

def convert_rating_to_int(rating_str):
    mapping = {"ONE": 1, "TWO": 2, "THREE": 3, "FOUR": 4, "FIVE": 5}
    return mapping.get(rating_str, 0)

def deliver_gbp_final(data, ai_reply, agent):
    """
    Final delivery hook to post the reply to Google.
    Called from tasks.py.
    """
    location_id = data.get('page_id')
    review_id = data.get('message_id')
    
    location = GoogleBusinessLocation.objects.filter(location_id=location_id).first()
    if not location:
        return False
        
    # URL: PUT https://mybusiness.googleapis.com/v4/{name}/reply
    url = f"https://mybusiness.googleapis.com/v4/{location_id}/reviews/{review_id}/reply"
    headers = {
        "Authorization": f"Bearer {location.account.access_token}",
        "Content-Type": "application/json"
    }
    payload = {"comment": ai_reply}
    
    try:
        resp = requests.put(url, json=payload, headers=headers)
        if resp.status_code == 200:
            logger.info(f"✅ [GBP Delivery] Successfully replied to review {review_id}")
            GBPReviewLog.objects.filter(review_id=review_id).update(
                ai_reply=ai_reply,
                status='replied'
            )
            return True
        else:
            logger.error(f"❌ [GBP Delivery] Failed to reply: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"❌ [GBP Delivery] Error: {str(e)}")
        return False
