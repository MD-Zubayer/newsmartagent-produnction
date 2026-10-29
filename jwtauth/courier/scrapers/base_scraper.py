import os
import json
import logging
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

STORAGE_DIR = os.path.join(os.path.dirname(__file__), "storage_states")
os.makedirs(STORAGE_DIR, exist_ok=True)


class BaseCourierScraper:
    provider_name = "base"

    def __init__(self, username=None, password=None):
        self.username = username
        self.password = password
        self.storage_file = os.path.join(STORAGE_DIR, f"{self.provider_name}_session.json")

    def has_valid_session(self):
        return os.path.exists(self.storage_file) and os.path.getsize(self.storage_file) > 10

    def launch_browser(self, playwright):
        """
        Launch Chromium browser with anti-detect settings:
        disables automation flags, sets standard desktop user-agent, and realistic viewport.
        """
        browser = playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
            ],
        )
        return browser

    def get_context(self, browser):
        storage_state = self.storage_file if self.has_valid_session() else None
        context = browser.new_context(
            storage_state=storage_state,
            viewport={"width": 1280, "height": 800},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-US",
        )
        # Apply anti-detection script
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
        """)
        return context

    def save_session(self, context):
        try:
            context.storage_state(path=self.storage_file)
            logger.info("[%s] Saved storage state to %s", self.provider_name, self.storage_file)
        except Exception as e:
            logger.warning("[%s] Failed to save storage state: %s", self.provider_name, e)

    def scrape_phone(self, phone: str) -> dict:
        """
        Override in subclasses. Returns normalized dict:
        {
            'delivered': int,
            'returned': int,
            'cancelled': int,
            'total': int,
            'success_rate': float or None,
            'risk_level': 'low' | 'medium' | 'high' | 'unknown',
            'raw_data': dict or str
        }
        """
        raise NotImplementedError
