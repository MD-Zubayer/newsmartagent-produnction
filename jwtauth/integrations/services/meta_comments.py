import logging

import requests

logger = logging.getLogger('aiAgent')

GRAPH = "https://graph.facebook.com/v21.0"

# Graph API error codes that mean "permission / app review missing"
_PERMISSION_CODES = {3, 10, 200, 283, 299}


def _result(response):
    """Normalise a Graph response into (ok, error_message, permission_missing)."""
    if response.status_code == 200:
        return True, "", False
    try:
        err = (response.json() or {}).get("error", {}) or {}
    except Exception:
        err = {}
    code = err.get("code")
    msg = err.get("message") or response.text[:300]
    return False, f"{code}: {msg}", code in _PERMISSION_CODES


class MetaCommentService:
    """Facebook / Instagram public-comment operations via Graph API (page token)."""

    @staticmethod
    def reply_public(platform, access_token, comment_id, text):
        edge = "comments" if platform == "facebook" else "replies"
        try:
            r = requests.post(
                f"{GRAPH}/{comment_id}/{edge}",
                params={"access_token": access_token},
                json={"message": text},
                timeout=15,
            )
            return _result(r)
        except Exception as exc:
            return False, str(exc), False

    @staticmethod
    def private_reply(access_token, comment_id, text):
        """Open a DM conversation from a comment (one private reply per comment, within 7 days)."""
        try:
            r = requests.post(
                f"{GRAPH}/me/messages",
                params={"access_token": access_token},
                json={"recipient": {"comment_id": comment_id}, "message": {"text": text}},
                timeout=15,
            )
            return _result(r)
        except Exception as exc:
            return False, str(exc), False

    @staticmethod
    def hide(platform, access_token, comment_id):
        body = {"is_hidden": True} if platform == "facebook" else {"hide": True}
        try:
            r = requests.post(
                f"{GRAPH}/{comment_id}",
                params={"access_token": access_token},
                json=body,
                timeout=15,
            )
            return _result(r)
        except Exception as exc:
            return False, str(exc), False

    @staticmethod
    def fetch_post_text(platform, access_token, post_id):
        """
        Returns a compact text describing a post / video / reel.
        Includes titles and descriptions of attachments so video-only posts still carry context.
        """
        if not post_id or not access_token:
            return ""
        try:
            if platform == "facebook":
                fields = "message,story,name,description,attachments{title,description,type}"
            else:
                fields = "caption,media_type"
            r = requests.get(
                f"{GRAPH}/{post_id}",
                params={"fields": fields, "access_token": access_token},
                timeout=6,
            )
            if r.status_code != 200:
                return ""
            data = r.json() or {}
            parts = []
            for key in ("message", "caption", "name", "description", "story"):
                val = data.get(key)
                if val and val not in parts:
                    parts.append(str(val).strip())
            for att in ((data.get("attachments") or {}).get("data") or []):
                for key in ("title", "description"):
                    val = att.get(key)
                    if val and val not in parts:
                        parts.append(str(val).strip())
            return " | ".join(p for p in parts if p)
        except Exception as exc:
            logger.debug(f"[MetaComment] fetch_post_text failed: {exc}")
            return ""

