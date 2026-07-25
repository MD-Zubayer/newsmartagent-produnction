from celery import shared_task
from django.contrib.auth import get_user_model
from embedding.utils import sync_spreadsheet_to_knowledge
from datasheet.models import Spreadsheet
from embedding.models import SpreadsheetKnowledge
import logging

logger = logging.getLogger('datasheet')
User = get_user_model()


@shared_task(bind=True)
def sync_spreadsheet_to_knowledge_task(self, user_id, grid_data, sheet_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.error(f"Spreadsheet sync failed: user {user_id} not found")
        return 0

    updated_rows = sync_spreadsheet_to_knowledge(user, grid_data, sheet_id)
    logger.info(f"Spreadsheet sync task completed for sheet={sheet_id}, rows={updated_rows}")
    return updated_rows


def calculate_match_score(product_name, title):
    import re
    prod_words = set(re.findall(r'[a-zA-Z0-9]+', product_name.lower()))
    title_words = set(re.findall(r'[a-zA-Z0-9]+', title.lower()))
    
    stopwords = {'a', 'an', 'the', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'with', 'by', 'site', 'bd', 'com', 'official', 'buy', 'online', 'price'}
    prod_words = prod_words - stopwords
    title_words = title_words - stopwords
    
    if not prod_words:
        return 1.0
        
    matched = prod_words.intersection(title_words)
    loose_matches = 0
    remaining_prod = prod_words - matched
    remaining_title = title_words - matched
    
    for pw in remaining_prod:
        for tw in remaining_title:
            if abs(len(pw) - len(tw)) <= 1:
                diffs = sum(1 for c1, c2 in zip(pw, tw) if c1 != c2) + abs(len(pw) - len(tw))
                if diffs <= 1:
                    loose_matches += 1
                    break
                    
    score = (len(matched) + loose_matches) / len(prod_words)
    return score


def is_reputable_candidate(candidate, product_name):
    title = candidate.get("t", "").lower()
    purl = candidate.get("purl", "").lower()
    murl = candidate.get("murl", "").lower()
    
    # 1. Alphanumeric match score
    score = calculate_match_score(product_name, title)
    if score < 0.35:
        return False, 0.0
        
    # 2. Check resolution
    try:
        w = int(candidate.get("w", 0))
        h = int(candidate.get("h", 0))
    except (ValueError, TypeError):
        w, h = 0, 0
        
    # We want at least 400x400 for a decent resolution, but not over 2500x2500
    if w > 0 and h > 0:
        if w < 400 or h < 400:
            return False, 0.0
        if w > 2500 or h > 2500:
            return False, 0.0
    
    # 3. Filter out watermarked stock sites, vector templates, and user-generated art scrapers
    bad_keywords = [
        "pinterest", "deviantart", "displate", "inspiredpencil", "fandom", 
        "facebook", "instagram", "stockphoto", "shutterstock", "dreamstime", 
        "depositphotos", "vectorstock", "alamy", "freepik", "123rf", "istock"
    ]
    for kw in bad_keywords:
        if kw in purl or kw in title or kw in murl:
            return False, 0.0
            
    # Calculate a quality rating/score
    # - Higher match score is better
    # - Resolution: ideal width is 500px - 1500px
    resolution_bonus = 0.0
    if 500 <= w <= 1500:
        resolution_bonus = 0.2
        
    # - Reputable domains get bonus
    reputable_keywords = [
        "daraz", "amazon", "gsmarena", "mobiledokan", "gadgets", "startech", 
        "ryanscomputers", "walmart", "ebay", "target", "official", "samsung", 
        "apple", "xiaomi", "redmi", "realme", "oppo", "vivo", "oneplus"
    ]
    reputable_bonus = 0.0
    for r_kw in reputable_keywords:
        if r_kw in purl or r_kw in title:
            reputable_bonus = 0.3
            break
            
    final_score = score + resolution_bonus + reputable_bonus
    return True, final_score


def scrape_image_from_url(url, headers):
    import requests
    import re
    from urllib.parse import urljoin
    try:
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code != 200:
            return None
        html = res.text
        
        # 1. og:image
        match = re.search(r'<meta[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', html)
        if not match:
            match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:image["\']', html)
        if not match:
            # 2. twitter:image
            match = re.search(r'<meta[^>]*name=["\']twitter:image["\'][^>]*content=["\']([^"\']+)["\']', html)
        if not match:
            # 3. ld+json image
            match = re.search(r'"image"\s*:\s*["\']([^"\']+)["\']', html)
            
        if match:
            img_url = match.group(1).strip()
            # Handle relative URLs
            if img_url.startswith("//"):
                img_url = "https:" + img_url
            elif img_url.startswith("/"):
                img_url = urljoin(url, img_url)
            return img_url
    except Exception:
        pass
def scrape_image_via_playwright(url, target_domain):
    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"]
            )
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            page.goto(url, timeout=30000)
            page.wait_for_timeout(3000)
            
            js_code = """
            () => {
                const imgs = Array.from(document.querySelectorAll('img'));
                const candidates = imgs.map(img => {
                    const rect = img.getBoundingClientRect();
                    const src = img.src || img.getAttribute('src') || '';
                    if (!src || src.startsWith('data:')) return null;
                    
                    // Filter out small images (icons, logos, rating stars)
                    if (rect.width < 150 || rect.height < 150) return null;
                    
                    // Filter out images in header, footer, or navigation
                    if (img.closest('header') || img.closest('footer') || img.closest('nav') || img.closest('.header') || img.closest('.footer')) return null;
                    
                    const area = rect.width * rect.height;
                    return { src, area };
                }).filter(Boolean);
                
                if (candidates.length > 0) {
                    candidates.sort((a, b) => b.area - a.area);
                    return candidates[0].src;
                }
                
                // Fallback: If no large candidate, return first image matching product keywords
                for (const img of imgs) {
                    const src = img.src || img.getAttribute('src') || '';
                    if (src && !src.startsWith('data:') && (src.includes('product') || src.includes('storex') || src.includes('cdn'))) {
                        if (!img.closest('header') && !img.closest('footer') && !img.closest('nav')) {
                            return src;
                        }
                    }
                }
                return null;
            }
            """
            product_img_url = page.evaluate(js_code)
            browser.close()
            return product_img_url
    except Exception:
        pass
    return None


@shared_task(bind=True)
def run_auto_image_search_task(self, sheet_id):
    import urllib.parse
    import re
    import requests
    from urllib.parse import urlparse
    from django.utils import timezone
    from django.core.files.storage import default_storage
    from django.core.files.base import ContentFile
    from embedding.models import RowImage, SpreadsheetKnowledge
    from .models import Spreadsheet
    from .tasks import process_row_image_task

    try:
        sheet = Spreadsheet.objects.get(pk=sheet_id)
    except Spreadsheet.DoesNotExist:
        logger.error(f"Auto image search failed: sheet {sheet_id} not found")
        return 0

    if not sheet.auto_image_search:
        logger.info(f"Auto image search skipped because setting is disabled for sheet {sheet_id}")
        return 0

    logs_list = []
    
    def log_progress(text):
        time_str = timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{time_str}] {text}"
        logs_list.append(log_line)
        logger.info(text)
        Spreadsheet.objects.filter(pk=sheet_id).update(image_search_log="\n".join(logs_list) + "\n")

    log_progress(f"Starting Auto Image Search for Spreadsheet: '{sheet.title}' (ID: {sheet_id})")

    data = sheet.data or {}
    
    # 1. Dynamically Detect Product Name Column Index
    product_col_idx = 1  # Default fallback
    header_cols = {}
    for key, val in data.items():
        if key.startswith("0-") and val:
            try:
                col_idx = int(key.split("-")[1])
                header_cols[col_idx] = str(val).strip().lower()
            except ValueError:
                continue

    # Priority header keywords
    priority_keywords = ["product name", "product_name", "product", "name", "item", "title", "caption"]
    found = False
    for kw in priority_keywords:
        for col_idx, header_val in header_cols.items():
            if kw in header_val:
                product_col_idx = col_idx
                found = True
                break
        if found:
            break

    if not found:
        # Check which column index has data entries (checking column index 2 first, then 1)
        if any(key.endswith("-2") and not key.startswith("0-") for key in data.keys()):
            product_col_idx = 2
        elif any(key.endswith("-1") and not key.startswith("0-") for key in data.keys()):
            product_col_idx = 1

    col_letter = chr(65 + product_col_idx) if product_col_idx < 26 else str(product_col_idx)
    log_progress(f"Detected product name column: Column {col_letter} (Index: {product_col_idx})")

    # 2. Detect Row-Level Website Link Columns
    link_col_idxs = []
    for col_idx, header_val in header_cols.items():
        if any(kw in header_val for kw in ["link", "website", "url", "source", "supplier"]):
            link_col_idxs.append(col_idx)
            
    if link_col_idxs:
        letters = [chr(65 + idx) if idx < 26 else str(idx) for idx in link_col_idxs]
        log_progress(f"Detected product source/website link columns: {', '.join(letters)} (Indexes: {link_col_idxs})")

    # Get search domain/site restriction
    domain = ""
    source_url_setting = getattr(sheet, "image_search_source_url", "").strip()
    if source_url_setting:
        parsed = urlparse(source_url_setting)
        domain = parsed.netloc or parsed.path
        domain = domain.split('/')[0].replace('www.', '').strip()
        log_progress(f"Restricting image search to website: '{domain}' (source: {source_url_setting})")
    else:
        log_progress("No restriction website set. Searching the open web.")

    updated = 0
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }

    # Loop through each row
    for r in range(1, sheet.rows):
        img_key = f"{r}-0"
        name_key = f"{r}-{product_col_idx}"
        
        product_name = data.get(name_key, "").strip()
        existing_img = data.get(img_key, "").strip()
        
        # If no product name is found in this row, check if any other column has values
        # (this avoids logging empty rows)
        row_has_any_data = any(key.startswith(f"{r}-") for key in data.keys())
        if not row_has_any_data:
            continue

        if not product_name:
            log_progress(f"Row {r}: Skipping - no product name found in Column {col_letter}.")
            continue

        if existing_img and (existing_img.startswith("http") or existing_img.startswith("/")):
            log_progress(f"Row {r}: Skipping product '{product_name}' - already has image: {existing_img}")
            continue

        log_progress(f"Row {r}: Product '{product_name}' needs image search.")
        try:
            # 0. Check for direct row-level website link in ANY column of row r (excluding r-0)
            scraped_url = None
            row_link = ""
            for key, val in data.items():
                if key.startswith(f"{r}-") and not key.endswith("-0"):
                    val_str = str(val).strip()
                    if val_str.startswith("http://") or val_str.startswith("https://"):
                        if not any(ext in val_str.lower() for ext in [".jpg", ".jpeg", ".png", ".webp", ".gif", "newsmartagent-media"]):
                            row_link = val_str
                            try:
                                col_idx_found = int(key.split("-")[1])
                                col_letter_found = chr(65 + col_idx_found) if col_idx_found < 26 else str(col_idx_found)
                            except ValueError:
                                col_letter_found = "?"
                            log_progress(f"Row {r}: Direct product page URL detected in Column {col_letter_found}: '{row_link}'. Scraping page...")
                            scraped_url = scrape_image_from_url(row_link, {"User-Agent": headers["User-Agent"]})
                            break
            
            downloaded = False
            
            # If direct link exists in row, try HTML scraping first, then Playwright dynamic rendering
            if row_link:
                img_res = None
                playwright_url = None
                if scraped_url:
                    log_progress(f"Row {r}: Extracted image URL from direct page HTML: {scraped_url}")
                    log_progress(f"Row {r}: Downloading direct page image...")
                    try:
                        img_res = requests.get(scraped_url, headers={"User-Agent": headers["User-Agent"], "Referer": row_link}, timeout=8)
                        if img_res.status_code != 200:
                            raise Exception(f"HTTP status {img_res.status_code}")
                    except Exception as e:
                        log_progress(f"Row {r}: Direct download of HTML image failed ({str(e)}). Attempting to load page dynamically via Playwright...")
                        img_res = None

                if not img_res or img_res.status_code != 200:
                    try:
                        parsed_row = urlparse(row_link)
                        target_domain = parsed_row.netloc or parsed_row.path
                        target_domain = target_domain.split('/')[0].replace('www.', '').strip()
                        playwright_url = scrape_image_via_playwright(row_link, target_domain)
                    except Exception as pw_err:
                        log_progress(f"Row {r}: Playwright browser launch failed: {str(pw_err)}")
                        
                    if playwright_url:
                        log_progress(f"Row {r}: Playwright dynamically extracted correct image URL: {playwright_url}")
                        log_progress(f"Row {r}: Downloading dynamic page image...")
                        try:
                            img_res = requests.get(playwright_url, headers={"User-Agent": headers["User-Agent"], "Referer": row_link}, timeout=8)
                        except Exception as dl_err:
                            img_res = None
                            log_progress(f"Row {r}: Playwright image download failed: {str(dl_err)}")

                if img_res and img_res.status_code == 200:
                    final_image_url = playwright_url if (playwright_url and playwright_url != scraped_url) else scraped_url
                    ext = "jpg"
                    if ".png" in final_image_url.lower():
                        ext = "png"
                    elif ".webp" in final_image_url.lower():
                        ext = "webp"
                    elif ".gif" in final_image_url.lower():
                        ext = "gif"
                        
                    filename = f"user_{sheet.user.id}/sheet_{sheet_id}/row_{r}/auto_{r}.{ext}"
                    if default_storage.exists(filename):
                        default_storage.delete(filename)
                        
                    saved_path = default_storage.save(filename, ContentFile(img_res.content))
                    local_url = default_storage.url(saved_path)
                    
                    data[img_key] = local_url
                    row_unique_id = f"sheet_{sheet_id}_row_{r}"
                    RowImage.objects.filter(user=sheet.user, row_id=row_unique_id).delete()
                    
                    row_img = RowImage.objects.create(
                        user=sheet.user,
                        row_id=row_unique_id,
                        image_url=local_url,
                        image_filename=product_name,
                        image_caption='',
                        image_embedding=None,
                        source='auto_search',
                        source_url=row_link,  # Store direct link as the source
                        is_primary=True,
                        position=0
                    )
                    
                    knowledge_obj, _ = SpreadsheetKnowledge.objects.get_or_create(
                        user=sheet.user,
                        row_id=row_unique_id,
                        defaults={'column_hashes': {}, 'content': ''}
                    )
                    knowledge_obj.image_url = local_url
                    knowledge_obj.image_source = 'auto_search'
                    knowledge_obj.save()
                    
                    process_row_image_task.delay(row_img.id)
                    log_progress(f"Row {r}: Direct image successfully saved locally: {local_url}")
                    log_progress(f"Row {r}: Scheduled caption/embedding processing.")
                    
                    downloaded = True
                    updated += 1
                else:
                    status_code_str = str(img_res.status_code) if img_res else "Failed/Timeout"
                    log_progress(f"Row {r}: Direct download returned HTTP {status_code_str} (blocked by CDN/Cloudflare). Falling back to search...")
                    try:
                        from chat.models import Notification
                        Notification.objects.create(
                            user=sheet.user,
                            message=f"Direct image download from '{row_link}' for product '{product_name}' failed/blocked (HTTP {status_code_str}). System is attempting fallback search.",
                            type='fallback_alert'
                        )
                    except Exception as n_ex:
                        logger.error(f"Failed to create notification: {n_ex}")

            # If not downloaded yet, proceed with smart search
            if not downloaded:
                import json
                candidates = []
                domain_candidates = []
                
                # Search restricted site first if domain is specified (or parsed from row_link)
                target_domain = domain
                if not target_domain and row_link:
                    parsed_row = urlparse(row_link)
                    target_domain = parsed_row.netloc or parsed_row.path
                    target_domain = target_domain.split('/')[0].replace('www.', '').strip()

                if target_domain:
                    search_query = f"{product_name} site:{target_domain}"
                    log_progress(f"Row {r}: Attempting domain-restricted search: '{search_query}'")
                    try:
                        url = f"https://www.bing.com/images/search?q={urllib.parse.quote(search_query)}"
                        res = requests.get(url, headers=headers, timeout=10)
                        if res.status_code == 200:
                            matches = re.findall(r'm="({[^"]+})"', res.text)
                            for m in matches:
                                try:
                                    unescaped = m.replace('&quot;', '"').replace('&amp;', '&')
                                    rdata = json.loads(unescaped)
                                    purl = rdata.get("purl", "")
                                    
                                    if target_domain in purl.lower():
                                        raw_score = calculate_match_score(product_name, rdata.get("t", ""))
                                        if raw_score >= 0.15:
                                            _, q_score = is_reputable_candidate(rdata, product_name)
                                            rdata["quality_score"] = q_score + 5.0
                                            domain_candidates.append(rdata)
                                except Exception:
                                    pass
                    except Exception as ex:
                        log_progress(f"Row {r}: Domain search error: {str(ex)}")

                    if not domain_candidates:
                        log_progress(f"Row {r}: No matches found directly on '{target_domain}' using strict search.")

                # General/Open Web Search
                search_query = product_name
                log_progress(f"Row {r}: Searching open web for: '{search_query}'")
                try:
                    url = f"https://www.bing.com/images/search?q={urllib.parse.quote(search_query)}"
                    res = requests.get(url, headers=headers, timeout=10)
                    if res.status_code == 200:
                        matches = re.findall(r'm="({[^"]+})"', res.text)
                        for m in matches:
                            try:
                                unescaped = m.replace('&quot;', '"').replace('&amp;', '&')
                                rdata = json.loads(unescaped)
                                purl = rdata.get("purl", "").lower()
                                
                                is_ok, q_score = is_reputable_candidate(rdata, product_name)
                                if is_ok:
                                    if target_domain and target_domain in purl:
                                        rdata["quality_score"] = q_score + 5.0
                                        domain_candidates.append(rdata)
                                    else:
                                        rdata["quality_score"] = q_score
                                        candidates.append(rdata)
                            except Exception:
                                pass
                except Exception as ex:
                    log_progress(f"Row {r}: Open web search error: {str(ex)}")

                all_candidates = domain_candidates + candidates
                if not all_candidates:
                    log_progress(f"Row {r}: Skipping - no relevant image matching '{product_name}' was found.")
                    continue

                all_candidates.sort(key=lambda x: x.get("quality_score", 0), reverse=True)
                log_progress(f"Row {r}: Identified {len(domain_candidates)} candidates from '{target_domain or 'N/A'}' and {len(candidates)} other candidates.")

                # Loop through candidates and attempt download
                for idx, candidate in enumerate(all_candidates[:8]):
                    img_src_url = candidate.get("murl")
                    web_source_url = candidate.get("purl") or img_src_url
                    title_text = candidate.get("t", "")
                    w = candidate.get("w", "unknown")
                    h = candidate.get("h", "unknown")
                    q_score = candidate.get("quality_score", 0)
                    
                    log_progress(f"Row {r}: Attempt {idx+1} - Candidate: '{title_text}' ({w}x{h}) [Match Score: {q_score:.2f}]")
                    log_progress(f"Row {r}: Image URL: {img_src_url}")
                    
                    try:
                        log_progress(f"Row {r}: Downloading image...")
                        try:
                            img_res = requests.get(img_src_url, headers={"User-Agent": headers["User-Agent"]}, timeout=5)
                            if img_res.status_code != 200:
                                raise Exception(f"HTTP status {img_res.status_code}")
                        except Exception as e:
                            thumbnail_url = candidate.get("turl")
                            if thumbnail_url:
                                log_progress(f"Row {r}: Original download failed ({str(e)}). Attempting to bypass CDN via Bing cached thumbnail: {thumbnail_url}")
                                img_res = requests.get(thumbnail_url, headers={"User-Agent": headers["User-Agent"]}, timeout=5)
                            else:
                                raise e
                                
                        if img_res.status_code != 200:
                            log_progress(f"Row {r}: Candidate download returned HTTP {img_res.status_code}. Trying next candidate...")
                            continue
                        
                        ext = "jpg"
                        if ".png" in img_src_url.lower():
                            ext = "png"
                        elif ".webp" in img_src_url.lower():
                            ext = "webp"
                        elif ".gif" in img_src_url.lower():
                            ext = "gif"
                        
                        filename = f"user_{sheet.user.id}/sheet_{sheet_id}/row_{r}/auto_{r}.{ext}"
                        if default_storage.exists(filename):
                            default_storage.delete(filename)
                            
                        saved_path = default_storage.save(filename, ContentFile(img_res.content))
                        local_url = default_storage.url(saved_path)
                        
                        data[img_key] = local_url
                        row_unique_id = f"sheet_{sheet_id}_row_{r}"
                        RowImage.objects.filter(user=sheet.user, row_id=row_unique_id).delete()
                        
                        row_img = RowImage.objects.create(
                            user=sheet.user,
                            row_id=row_unique_id,
                            image_url=local_url,
                            image_filename=product_name,
                            image_caption='',
                            image_embedding=None,
                            source='auto_search',
                            source_url=web_source_url,
                            is_primary=True,
                            position=0
                        )
                        
                        knowledge_obj, _ = SpreadsheetKnowledge.objects.get_or_create(
                            user=sheet.user,
                            row_id=row_unique_id,
                            defaults={'column_hashes': {}, 'content': ''}
                        )
                        knowledge_obj.image_url = local_url
                        knowledge_obj.image_source = 'auto_search'
                        knowledge_obj.save()
                        
                        process_row_image_task.delay(row_img.id)
                        log_progress(f"Row {r}: Image successfully saved locally: {local_url}")
                        log_progress(f"Row {r}: Scheduled caption/embedding processing for image.")
                        
                        downloaded = True
                        updated += 1
                        break
                        
                    except Exception as dl_ex:
                        log_progress(f"Row {r}: Candidate download failed: {str(dl_ex)}. Trying next candidate...")
                        continue

                if not downloaded:
                    log_progress(f"Row {r}: Failed to download any of the top {len(all_candidates[:8])} candidates.")
                    
        except Exception as inner_ex:
            log_progress(f"Row {r}: Error occurred: {str(inner_ex)}")
            continue
            
    if updated > 0:
        sheet.data = data
        sheet.save()
        log_progress(f"Completed! Auto image search successfully updated {updated} rows in spreadsheet.")
    else:
        log_progress("Completed! No new images were found or updated.")
        
    return updated


def sync_primary_image_to_knowledge(user, row_id):
    """
    Synchronizes the primary image of a row (from RowImage model) to the corresponding
    SpreadsheetKnowledge model fields (image_url, image_caption, image_embedding).
    If no primary exists, it defaults to the first image, or clears the fields if no images exist.
    """
    from embedding.models import RowImage, SpreadsheetKnowledge
    from django.utils import timezone

    # Get primary image or the first image
    primary_img = RowImage.objects.filter(user=user, row_id=row_id, is_primary=True).first()
    if not primary_img:
        primary_img = RowImage.objects.filter(user=user, row_id=row_id).order_by('position', 'created_at').first()

    # Get or create SpreadsheetKnowledge object
    obj, created = SpreadsheetKnowledge.objects.get_or_create(
        user=user,
        row_id=row_id,
        defaults={'column_hashes': {}, 'content': ''}
    )

    if primary_img:
        obj.image_url = primary_img.image_url
        obj.image_caption = primary_img.image_caption or ''
        obj.image_embedding = primary_img.image_embedding
        obj.image_source = primary_img.source
        obj.image_updated_at = primary_img.updated_at or timezone.now()
    else:
        obj.image_url = ''
        obj.image_caption = ''
        obj.image_embedding = None
        obj.image_source = None
        obj.image_updated_at = None

    obj.save()


@shared_task(
    bind=True,
    max_retries=5,
    default_retry_delay=15,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300
)
def process_row_image_task(self, row_image_id):
    from embedding.models import RowImage
    from embedding.utils import get_gemini_image_embedding, get_image_caption, get_gemini_embedding
    from settings.models import GlobalSettings

    try:
        row_img = RowImage.objects.get(pk=row_image_id)
    except RowImage.DoesNotExist:
        logger.error(f"RowImage not found: {row_image_id}")
        return False

    image_url = row_img.image_url
    if not image_url:
        return False

    logger.info(f"Processing image API calls for RowImage {row_image_id}: {image_url}")

    # 1. Image Embedding
    image_vector = get_gemini_image_embedding(image_url)

    # 2. Caption
    global_settings = GlobalSettings.get_settings()
    selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
    
    # Try to find corresponding SpreadsheetKnowledge for fallback text
    from embedding.models import SpreadsheetKnowledge
    fallback_text = 'Product Image'
    try:
        obj = SpreadsheetKnowledge.objects.get(user=row_img.user, row_id=row_img.row_id)
        if obj.content:
            fallback_text = obj.content
    except SpreadsheetKnowledge.DoesNotExist:
        pass

    image_caption = get_image_caption(image_url, provider=selected_provider, fallback_text=fallback_text)

    # Save to RowImage
    row_img.image_caption = image_caption or ''
    if image_vector:
        row_img.image_embedding = image_vector
    if image_caption:
        row_img.caption_embedding = get_gemini_embedding(image_caption)
    row_img.save()

    # 3. Synchronize to SpreadsheetKnowledge if primary
    sync_primary_image_to_knowledge(row_img.user, row_img.row_id)

    # Introduce sleep delay to stagger consecutive API calls and prevent rate limiting
    import time
    time.sleep(2)

    return True

