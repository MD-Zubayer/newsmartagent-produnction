import logging
import urllib.request
import urllib.parse
import json
from decimal import Decimal
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

STEADFAST_QUOTE_URL = "https://steadfast.com.bd/pricing/quote"


def fetch_steadfast_live_price(
    to_city_id: int,
    from_city_id: int = 1,
    weight: float = 0.5,
    cod: float = 0.0,
    delivery_type: int = 0, # 0 = home, 1 = point
    timeout: int = 4
) -> Optional[Dict[str, Any]]:
    """
    Fetches real-time delivery pricing directly from Steadfast's live quote engine:
    https://steadfast.com.bd/pricing/quote

    Returns:
        dict with keys:
            - charge (Decimal)
            - lane (str)
            - available (bool)
            - options (dict)
        or None if failed.
    """
    try:
        weight_val = max(0.1, round(float(weight or 0.5), 2))
        params = {
            "from": int(from_city_id or 1),
            "to": int(to_city_id),
            "weight": weight_val,
            "cod": int(round(float(cod or 0))),
            "category": 1,   # Regular parcel
            "service": 1,    # Standard delivery
            "delivery": int(delivery_type or 0),
        }
        url = f"{STEADFAST_QUOTE_URL}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
            }
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                raw_data = resp.read().decode("utf-8")
                data = json.loads(raw_data)
                charge = data.get("charge")
                if charge is not None and float(charge) > 0:
                    return {
                        "charge": Decimal(str(charge)),
                        "lane": data.get("lane") or "",
                        "available": data.get("available", True),
                        "options": data.get("options") or {},
                        "cod": data.get("cod")
                    }
    except Exception as exc:
        logger.warning(f"Failed to fetch live quote from Steadfast: {exc}")
    return None


def scrape_steadfast_price_playwright(
    to_city_id: int,
    from_city_id: int = 1,
    weight: float = 0.5,
    cod: float = 0.0
) -> Optional[Decimal]:
    """
    Fallback headless Playwright scraper to get Steadfast pricing
    if the direct quote endpoint is ever blocked or firewalled.
    """
    try:
        from playwright.sync_api import sync_playwright
        from courier.scrapers.base_scraper import BaseCourierScraper
        scraper = BaseCourierScraper()
        scraper.provider_name = "steadfast"
        with sync_playwright() as p:
            browser = scraper.launch_browser(p)
            context = scraper.get_context(browser)
            page = context.new_page()
            try:
                page.goto("https://steadfast.com.bd/pricing", wait_until="domcontentloaded", timeout=15000)
                res = page.evaluate("""
                    async ({fromId, toId, weight, cod}) => {
                        const resp = await fetch(`/pricing/quote?from=${fromId}&to=${toId}&weight=${weight}&cod=${cod}&category=1&service=1&delivery=0`, {
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        });
                        return await resp.json();
                    }
                """, {"fromId": int(from_city_id or 1), "toId": int(to_city_id), "weight": float(weight or 0.5), "cod": int(cod or 0)})
                if res and res.get("charge"):
                    return Decimal(str(res["charge"]))
            finally:
                context.close()
                browser.close()
    except Exception as e:
        logger.error(f"Playwright Steadfast price scrape error: {e}")
    return None
