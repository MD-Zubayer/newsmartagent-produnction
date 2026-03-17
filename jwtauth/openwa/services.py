import logging
from typing import Optional, Tuple

import requests
from django.conf import settings

logger = logging.getLogger('openwa')


def stop_baileys_session_for_user(user_id: int) -> Optional[requests.Response]:
    """
    Stop and delete the Baileys session for the given user ID.
    Returns the response object when the request was sent, or None on transport error.
    """
    session_id = f"user_{user_id}"
    url = f"{settings.BAILEYS_API_URL}/session/{session_id}"

    try:
        resp = requests.delete(
            url,
            headers={'x-api-secret': settings.BAILEYS_API_SECRET},
            timeout=5,
        )

        if resp.status_code == 404:
            logger.info("Baileys session %s not found during cleanup", session_id)
        elif resp.ok:
            logger.info("Baileys session %s stopped and removed", session_id)
        else:
            logger.warning(
                "Baileys session %s cleanup returned %s: %s",
                session_id, resp.status_code, resp.text,
            )
        return resp
    except Exception as exc:  # requests.RequestException & others
        logger.error("Failed to stop Baileys session %s: %s", session_id, exc)
        return None


def fetch_baileys_status(session_id: str) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[int]]:
    """
    Returns (state, phone, pairing_code, status_code).
    On transport error, returns (None, None, None, None) and logs a warning.
    """
    try:
        resp = requests.get(
            f"{settings.BAILEYS_API_URL}/status/{session_id}",
            timeout=5,
        )
        if resp.status_code == 404:
            return 'close', None, None, resp.status_code

        resp.raise_for_status()
        data = resp.json()
        return data.get('state'), data.get('phone'), data.get('pairingCode'), resp.status_code
    except Exception as exc:  # requests.RequestException & JSON issues
        logger.warning("Baileys status check failed for %s: %s", session_id, exc)
        return None, None, None, None
