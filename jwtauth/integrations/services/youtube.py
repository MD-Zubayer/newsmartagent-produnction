import requests
import logging

logger = logging.getLogger('aiAgent')

class YouTubeService:
    @staticmethod
    def send_comment_reply(access_token, parent_id, message_text):
        """
        Reply to a comment parentId on YouTube using OAuth2 Access Token
        """
        url = "https://www.googleapis.com/youtube/v3/comments?part=snippet"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "snippet": {
                "parentId": parent_id,
                "textOriginal": message_text
            }
        }
        try:
            logger.info(f"[YouTubeService] Sending direct comment reply to parent: {parent_id}")
            response = requests.post(url, json=payload, headers=headers, timeout=15)
            if response.status_code in [200, 201]:
                return True
            logger.error(f"[YouTubeService] Direct reply error: {response.status_code} - {response.text}")
            return False
        except Exception as e:
            logger.error(f"[YouTubeService] Exception: {e}")
            return False
