"""
aiAgent Signals - For AI agent events
Note: Customer order invoice handling is now in users/signals.py
"""

import logging

logger = logging.getLogger(__name__)


def connect_signals():
    """
    Connect any aiAgent-related signals here.
    This file is intentionally minimal because invoice handling is now in users/signals.py.
    """
    logger.info("aiAgent signals module loaded; no signals registered here by default.")
