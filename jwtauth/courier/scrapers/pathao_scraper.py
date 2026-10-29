import logging
import re
from playwright.sync_api import sync_playwright
from .base_scraper import BaseCourierScraper

logger = logging.getLogger(__name__)


class PathaoMerchantScraper(BaseCourierScraper):
    provider_name = "pathao"

    def _login(self, page):
        """
        Logs into Pathao Merchant Panel if session is not active.
        """
        if not self.username or not self.password:
            raise ValueError("Pathao username and password required for initial login.")

        logger.info("[PathaoScraper] Navigating to login page...")
        page.goto("https://merchant.pathao.com/login", wait_until="networkidle", timeout=30000)

        # Check if already logged in (redirected to dashboard)
        if "login" not in page.url:
            logger.info("[PathaoScraper] Already logged in via cookies.")
            return

        # Fill credentials
        page.fill("input[type='email'], input[name='username'], input[name='email']", self.username)
        page.fill("input[type='password']", self.password)

        # Submit login form
        submit_button = page.locator("button[type='submit']")
        if submit_button.count() > 0:
            submit_button.first.click()
        else:
            page.keyboard.press("Enter")

        # Wait for dashboard URL or navigation
        page.wait_for_load_state("networkidle", timeout=25000)
        logger.info("[PathaoScraper] Login successful. Current URL: %s", page.url)

    def scrape_phone(self, phone: str) -> dict:
        """
        Navigates to Pathao merchant fraud/delivery lookup panel, inputs customer phone,
        intercepts the network responses and parses the delivery performance.
        """
        digits = re.sub(r"\D", "", str(phone or ""))
        if digits.startswith("880"):
            digits = "0" + digits[3:]

        result = {
            "delivered": 0,
            "returned": 0,
            "cancelled": 0,
            "total": 0,
            "success_rate": None,
            "risk_level": "unknown",
            "raw_data": {},
        }

        with sync_playwright() as p:
            browser = self.launch_browser(p)
            context = self.get_context(browser)
            page = context.new_page()

            captured_api_data = {}

            # Intercept API responses related to fraud or customer rating
            def on_response(response):
                try:
                    url = response.url.lower()
                    if any(key in url for key in ["fraud", "customer", "success-rate", "rating", "delivery-rate"]):
                        if response.status == 200:
                            data = response.json()
                            captured_api_data.update(data if isinstance(data, dict) else {"data": data})
                except Exception:
                    pass

            page.on("response", on_response)

            try:
                # 1. Ensure logged in
                page.goto("https://merchant.pathao.com/", wait_until="domcontentloaded", timeout=25000)
                if "login" in page.url:
                    self._login(page)
                    self.save_session(context)

                # 2. Go to customer lookup / fraud check section
                lookup_urls = [
                    "https://merchant.pathao.com/customer-rating",
                    "https://merchant.pathao.com/fraud-check",
                    "https://merchant.pathao.com/orders/create",
                ]

                for target_url in lookup_urls:
                    try:
                        resp = page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
                        if resp and resp.status == 200 and "login" not in page.url:
                            break
                    except Exception:
                        continue

                # 3. Locate phone search input
                phone_inputs = page.locator("input[placeholder*='phone' i], input[placeholder*='01' i], input[name*='phone' i], input[type='tel']")
                if phone_inputs.count() > 0:
                    input_box = phone_inputs.first
                    input_box.fill(digits)
                    page.keyboard.press("Enter")
                    page.wait_for_timeout(3500)

                # 4. Extract captured API data if found
                if captured_api_data:
                    result["raw_data"] = captured_api_data
                    delivered = captured_api_data.get("delivered") or captured_api_data.get("success") or 0
                    returned = captured_api_data.get("returned") or captured_api_data.get("cancelled") or captured_api_data.get("failed") or 0
                    total = captured_api_data.get("total") or (delivered + returned)
                    
                    rate = captured_api_data.get("success_rate") or captured_api_data.get("delivery_rate")
                    if rate is None and total > 0:
                        rate = round((delivered / total) * 100)

                    result["delivered"] = int(delivered)
                    result["returned"] = int(returned)
                    result["total"] = int(total)
                    result["success_rate"] = int(rate) if rate is not None else None
                else:
                    # Parse DOM text for delivery counts if API wasn't triggered
                    body_text = page.inner_text("body")
                    del_match = re.search(r"(?:Delivered|সফল)\s*[:=-]?\s*(\d+)", body_text, re.IGNORECASE)
                    ret_match = re.search(r"(?:Returned|Cancel|বাতিল)\s*[:=-]?\s*(\d+)", body_text, re.IGNORECASE)
                    tot_match = re.search(r"(?:Total|মোট)\s*[:=-]?\s*(\d+)", body_text, re.IGNORECASE)
                    rate_match = re.search(r"(?:Rate|হার)\s*[:=-]?\s*(\d+)%", body_text, re.IGNORECASE)

                    if del_match:
                        result["delivered"] = int(del_match.group(1))
                    if ret_match:
                        result["returned"] = int(ret_match.group(1))
                    if tot_match:
                        result["total"] = int(tot_match.group(1))
                    elif result["delivered"] or result["returned"]:
                        result["total"] = result["delivered"] + result["returned"]

                    if rate_match:
                        result["success_rate"] = int(rate_match.group(1))
                    elif result["total"] > 0:
                        result["success_rate"] = round((result["delivered"] / result["total"]) * 100)

                # 5. Calculate risk level
                sr = result["success_rate"]
                if result["total"] == 0:
                    result["risk_level"] = "unknown"
                elif sr is not None and sr >= 80:
                    result["risk_level"] = "low"
                elif sr is not None and sr >= 60:
                    result["risk_level"] = "medium"
                else:
                    result["risk_level"] = "high"

                self.save_session(context)

            except Exception as e:
                logger.exception("[PathaoScraper] Error scraping phone %s: %s", digits[-4:], e)
            finally:
                context.close()
                browser.close()

        return result

