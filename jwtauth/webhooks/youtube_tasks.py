import requests
import logging
from celery import shared_task
from django.conf import settings
from django.utils import timezone
from users.models import YouTubeChannel
from aiAgent.models import AgentAI
from aiAgent.business_logic.logic_handler import get_ai_response, build_ai_context

logger = logging.getLogger(__name__)

@shared_task(queue='chat_queue')
def check_youtube_comments():
    """
    Periodic task to check for new comments on all active YouTube channels.
    """
    active_channels = YouTubeChannel.objects.filter(is_active=True)
    logger.info(f"🚀 [YouTube Task] Starting check for {active_channels.count()} active channels.")
    
    for channel in active_channels:
        try:
            logger.info(f"🔍 [YouTube Task] Checking channel: {channel.channel_title} (@{channel.custom_url or channel.channel_id})")
            process_channel_comments(channel)
        except Exception as e:
            logger.error(f"❌ [YouTube Task] Error processing channel {channel.channel_id}: {str(e)}")

def process_channel_comments(channel):
    """
    Fetches and processes comments for a single YouTube channel.
    """
    url = "https://www.googleapis.com/youtube/v3/commentThreads"
    params = {
        "part": "snippet,replies",
        "allThreadsRelatedToChannelId": channel.channel_id,
        "maxResults": 20,
        "order": "time",
        "access_token": channel.access_token
    }
    
    response = requests.get(url, params=params)
    
    if response.status_code == 401:
        logger.warning(f"🔑 [YouTube Task] Token expired for {channel.channel_title}. Attempting refresh.")
        new_token = refresh_youtube_token(channel)
        if new_token:
            params["access_token"] = new_token
            response = requests.get(url, params=params)
        else:
            logger.error(f"❌ [YouTube Task] Failed to refresh token for {channel.channel_id}")
            return

    if response.status_code != 200:
        logger.error(f"❌ [YouTube Task] API error for {channel.channel_id}: {response.text}")
        return

    data = response.json()
    items = data.get("items", [])
    logger.info(f"📝 [YouTube Task] Found {len(items)} comment threads for channel {channel.channel_title}")
    
    new_last_check = timezone.now()
    processed_count = 0
    skipped_count = 0
    
    for item in items:
        snippet = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
        comment_id = item.get("id")
        comment_text = snippet.get("textDisplay")
        author_name = snippet.get("authorDisplayName")
        author_id = snippet.get("authorChannelId", {}).get("value")
        published_at = snippet.get("publishedAt")
        video_id = snippet.get("videoId")
        
        # Check if this comment is newer than our last check
        published_dt = timezone.datetime.fromisoformat(published_at.replace('Z', '+00:00'))
        
        if channel.last_comment_check and published_dt <= channel.last_comment_check:
            skipped_count += 1
            continue
            
        if author_id == channel.channel_id:
            logger.info(f"⏭️ [YouTube Task] Skipping own comment from {author_name}")
            continue

        logger.info(f"✨ [YouTube Task] New comment by {author_name}: {comment_text[:50]}...")

        # 2. Generate AI Reply
        agent = AgentAI.objects.filter(page_id=channel.channel_id, platform='youtube', is_active=True).first()
        if not agent:
            logger.warning(f"⚠️ [YouTube Task] No active AgentAI found for {channel.channel_title}")
            continue

        logger.info(f"🤖 [YouTube Task] Generating AI reply for comment ID {comment_id}")
        system_instruction, history, _ = build_ai_context(
            agent, 
            sender_id=author_name, 
            text=comment_text, 
            extra_instr=f"User is commenting on your YouTube video (ID: {video_id}).", 
            sheet_ctx="", 
            platform='youtube'
        )
        
        ai_reply, _, _ = get_ai_response(agent, system_instruction, history, comment_text)
        logger.info(f"✅ [YouTube Task] AI reply generated: {ai_reply[:50]}...")
        
        # 3. Deliver to n8n
        deliver_youtube_reply_to_n8n(channel, agent, item, ai_reply)
        processed_count += 1

    logger.info(f"📊 [YouTube Task] Channel {channel.channel_title} summary: Proccesed {processed_count}, Skipped {skipped_count}")
    
    # Update last check time
    channel.last_comment_check = new_last_check
    channel.save(update_fields=['last_comment_check'])

def refresh_youtube_token(channel):
    """
    Refreshes the YouTube access token using the refresh_token.
    """
    if not channel.refresh_token:
        logger.warning(f"⚠️ [YouTube Task] No refresh token available for {channel.channel_title}")
        return None
        
    url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": settings.YOUTUBE_CLIENT_ID,
        "client_secret": settings.YOUTUBE_CLIENT_SECRET,
        "refresh_token": channel.refresh_token,
        "grant_type": "refresh_token"
    }
    
    resp = requests.post(url, data=data).json()
    new_access_token = resp.get("access_token")
    expires_in = resp.get("expires_in")
    
    if new_access_token:
        logger.info(f"♻️ [YouTube Task] Successfully refreshed token for {channel.channel_title}")
        channel.access_token = new_access_token
        if expires_in:
            channel.token_expires_at = timezone.now() + timezone.timedelta(seconds=expires_in)
        channel.save(update_fields=['access_token', 'token_expires_at'])
        
        AgentAI.objects.filter(page_id=channel.channel_id, platform='youtube').update(access_token=new_access_token)
        return new_access_token
    else:
        logger.error(f"❌ [YouTube Task] Refresh failed response: {resp}")
    return None

def deliver_youtube_reply_to_n8n(channel, agent, comment_item, ai_reply):
    """
    Sends the comment and AI-generated reply to the n8n webhook.
    """
    from users.models import YouTubeCommentLog
    
    snippet = comment_item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
    comment_id = comment_item.get("id")
    
    # Pre-save the log
    log_entry = YouTubeCommentLog.objects.create(
        channel=channel,
        video_id=snippet.get("videoId", ""),
        comment_id=comment_id,
        author=snippet.get("authorDisplayName", "Unknown"),
        comment_text=snippet.get("textDisplay", ""),
        ai_reply=ai_reply,
        status='pending'
    )

    webhook_url = getattr(settings, 'N8N_YOUTUBE_WEBHOOK_URL', None)
    if not webhook_url:
        logger.warning("N8N_YOUTUBE_WEBHOOK_URL not configured")
        log_entry.status = 'failed'
        log_entry.save()
        return

    payload = {
        "platform": "youtube",
        "channel_id": channel.channel_id,
        "channel_title": channel.channel_title,
        "agent_name": agent.name,
        "video_id": snippet.get("videoId"),
        "comment_id": comment_id,
        "author_name": snippet.get("authorDisplayName"),
        "comment_text": snippet.get("textDisplay"),
        "generated_reply": ai_reply,
        "timestamp": timezone.now().isoformat()
    }
    
    try:
        requests.post(webhook_url, json=payload, timeout=10)
        logger.info(f"YouTube comment reply delivered to n8n for channel {channel.channel_id}")
        log_entry.status = 'success'
        log_entry.save()
    except Exception as e:
        logger.error(f"Failed to deliver YouTube reply to n8n: {e}")
        log_entry.status = 'failed'
        log_entry.save()
