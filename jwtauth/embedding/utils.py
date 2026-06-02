from google import genai
from google.genai import types
from django.conf import settings
from django.utils import timezone
import hashlib
from embedding.models import SpreadsheetKnowledge
import logging
import requests
from io import BytesIO
from settings.models import GlobalSettings
import base64
import imghdr


client = genai.Client(api_key=settings.GEMINI_API_KEY)

logger = logging.getLogger('aiAgent')




def get_gemini_embedding(text):

    print(f"\n--- [DEBUG] Starting Text Embedding Process ---")
    print(f"[DEBUG] Input Text: {text[:100]}...")

    if not text or not isinstance(text, str):
        print(f"[DEBUG] Error: Invalid input text.")
        return None

    try:
        response = client.models.embed_content(
            model='models/gemini-embedding-2',
            contents=[text],
            config={
                'output_dimensionality': 768
            }
        )

        embedding_values = response.embeddings[0].values
        print(f"[DEBUG] Success! Text Vector Length: {len(embedding_values)}")
        print(f"[DEBUG] First 5 values: {embedding_values[:5]}")
        print(f"--- [DEBUG] Text Embedding Process Finished ---\n")
        return list(embedding_values)
    except Exception as e:
        print(f"Text Embedding API Error: {e}")
        return None


def get_gemini_image_embedding(image_url):
    print(f"\n--- [DEBUG] Starting Image Embedding Process ---")
    print(f"[DEBUG] Image URL type: {type(image_url)}, length: {len(image_url) if image_url else 0}")
    print(f"[DEBUG] URL starts with: {image_url[:80] if image_url else 'None'}")

    if not image_url or not isinstance(image_url, str):
        print(f"❌ [DEBUG] Error: Invalid image URL.")
        return None

    try:
        # Check if it's a data URL
        if image_url.startswith('data:'):
            print(f"✅ [DEBUG] Detected data URL format.")
        
        print(f"[DEBUG] Calling Gemini embedding API...")
        response = client.models.embed_content(
            model='models/gemini-embedding-2',
            contents=[image_url],
            config={
                'output_dimensionality': 768
            }
        )

        embedding_values = response.embeddings[0].values
        print(f"✅ [DEBUG] Image Embedding Success! Vector Length: {len(embedding_values)}")
        print(f"--- [DEBUG] Image Embedding Process Finished ---\n")
        return list(embedding_values)
    except Exception as e:
        print(f"❌ Image Embedding API Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return None


def sync_spreadsheet_to_knowledge(user, grid_data, sheet_id):
    # ১. হেডারগুলো নিয়ে একটি সর্টেড ডিকশনারি তৈরি (অর্ডার ফিক্সড করার জন্য)
    header_keys = sorted([k for k in grid_data.keys() if k.startswith('0-')])
    headers = {
        k.split('-')[1]: str(grid_data[k]).strip()
        for k in header_keys
    }

    # হেডার হ্যাশ (সবসময় একই অর্ডারে স্ট্রিং তৈরি হবে)
    header_content = "|".join([f"{c}:{headers[c]}" for c in sorted(headers.keys())])
    header_hash = hashlib.md5(header_content.encode()).hexdigest()

    # ২. ডাটা রো প্রসেস করা
    rows = {}
    current_row_ids = []

    for k, v in grid_data.items():
        if '-' not in k or k.startswith('0-'): continue
        r_idx, c_idx = k.split('-')

        row_unique_id = f"sheet_{sheet_id}_row_{r_idx}"
        if r_idx not in rows:
            rows[r_idx] = {}
            current_row_ids.append(row_unique_id)

        rows[r_idx][c_idx] = str(v).strip() if v is not None else ""

    SpreadsheetKnowledge.objects.filter(
        user=user,
        row_id__startswith=f"sheet_{sheet_id}_",
    ).exclude(row_id__in=current_row_ids).delete()

    updated_count = 0

    for r_idx, cols in rows.items():
        row_unique_id = f"sheet_{sheet_id}_row_{r_idx}"
        image_url = cols.get('0', '').strip()

        # সাধারণ টেক্সট কন্টেন্ট গঠনের জন্য A কলাম বাদ
        text_cols = {k: v for k, v in cols.items() if k != '0'}
        sorted_text_cols = sorted(text_cols.keys())
        text_content = "|".join([f"{c}:{text_cols[c]}" for c in sorted_text_cols])
        combined_hash = hashlib.md5((text_content + header_hash).encode()).hexdigest()
        image_hash = hashlib.md5(image_url.encode()).hexdigest() if image_url else ''

        obj, created = SpreadsheetKnowledge.objects.get_or_create(
            user=user,
            row_id=row_unique_id,
            defaults={'column_hashes': {}, 'content': ''}
        )

        old_hash = obj.column_hashes.get('combined_hash')
        old_image_url = obj.image_url or ''
        old_image_hash = obj.column_hashes.get('image_hash', '')

        should_update_text = created or old_hash != combined_hash
        should_update_image = image_url and (created or old_image_url != image_url or obj.image_embedding is None)

        if not text_content and not image_url:
            obj.delete()
            continue

        if should_update_text:
            row_text_parts = []
            for c in sorted_text_cols:
                col_val = text_cols[c].strip()
                if col_val and col_val.lower() != 'none':
                    header_name = headers.get(c, f'col_{c}')
                    row_text_parts.append(f"{header_name}: {col_val}")

            row_text = ", ".join(row_text_parts)
            obj.content = row_text
            if row_text:
                vector = get_gemini_embedding(row_text)
                if vector:
                    obj.embedding = vector
            else:
                obj.embedding = None

        if should_update_image:
            image_vector = get_gemini_image_embedding(image_url)
            # Use provider from GlobalSettings
            global_settings = GlobalSettings.get_settings()
            selected_provider = getattr(global_settings, 'image_caption_provider', 'gemini') or 'gemini'
            image_caption = get_image_caption(image_url, provider=selected_provider)
            obj.image_url = image_url
            obj.image_caption = image_caption or ''
            if image_vector:
                obj.image_embedding = image_vector
                obj.image_source = 'manual'
                obj.image_updated_at = timezone.now()
        elif image_url and obj.image_url != image_url:
            obj.image_url = image_url
        elif not image_url and obj.image_url:
            obj.image_url = ''
            obj.image_caption = ''
            obj.image_embedding = None
            obj.image_source = None
            obj.image_updated_at = None

        obj.column_hashes = {
            'combined_hash': combined_hash,
            'image_hash': image_hash
        }

        obj.save()
        updated_count += 1

    return updated_count


def detect_image_format_from_bytes(image_data):
    """
    Detect image format by examining magic bytes and using PIL/imghdr.
    Returns: ('image/jpeg'|'image/png'|'image/webp'|'image/gif', detection_method)
    """
    if not image_data or len(image_data) < 4:
        print(f"[DEBUG] Image data too small or empty, defaulting to image/jpeg")
        return 'image/jpeg', 'default'
    
    # Try PIL/Pillow first (most robust)
    try:
        from PIL import Image
        from io import BytesIO
        img = Image.open(BytesIO(image_data))
        img_format = img.format.lower() if img.format else None
        if img_format:
            mime_map = {
                'jpeg': 'image/jpeg',
                'jpg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp',
            }
            mime = mime_map.get(img_format, 'image/jpeg')
            print(f"[DEBUG] PIL detected format: {img_format} -> {mime}")
            return mime, 'pil_detection'
    except Exception as e:
        print(f"[DEBUG] PIL detection skipped or failed: {type(e).__name__}")
    
    # Try imghdr as secondary
    try:
        import imghdr
        detected_type = imghdr.what(None, h=image_data)
        if detected_type:
            mime_map = {
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp',
            }
            mime = mime_map.get(detected_type, 'image/jpeg')
            print(f"[DEBUG] imghdr detected format: {detected_type} -> {mime}")
            return mime, 'imghdr_detection'
    except Exception as e:
        print(f"[DEBUG] imghdr detection skipped or failed")
    
    # Manual magic byte detection as fallback
    if image_data[:3] == b'\xff\xd8\xff':
        print(f"[DEBUG] Detected JPEG from magic bytes")
        return 'image/jpeg', 'magic_bytes_jpeg'
    elif image_data[:8] == b'\x89PNG\r\n\x1a\n':
        print(f"[DEBUG] Detected PNG from magic bytes")
        return 'image/png', 'magic_bytes_png'
    elif image_data[:4] == b'RIFF' and len(image_data) >= 12 and image_data[8:12] == b'WEBP':
        print(f"[DEBUG] Detected WebP from magic bytes")
        return 'image/webp', 'magic_bytes_webp'
    elif image_data[:6] in [b'GIF87a', b'GIF89a']:
        print(f"[DEBUG] Detected GIF from magic bytes")
        return 'image/gif', 'magic_bytes_gif'
    
    # Last resort: log first bytes for debugging, default to JPEG
    first_bytes_hex = image_data[:32].hex()
    print(f"[DEBUG] No format detected. First 32 bytes (hex): {first_bytes_hex}")
    print(f"[DEBUG] Image size: {len(image_data)} bytes")
    return 'image/jpeg', 'fallback_default'


def get_gemini_image_caption(image_url):
    print(f"\n--- [DEBUG] Starting Image Caption Process ---")
    print(f"[DEBUG] Image URL type: {type(image_url)}, length: {len(image_url) if image_url else 0}")
    print(f"[DEBUG] URL starts with: {image_url[:80] if image_url else 'None'}")

    if not image_url or not isinstance(image_url, str):
        print(f"❌ [DEBUG] Error: Invalid image URL for caption generation.")
        return None

    try:
        # ১. ইমেজ ডাউনলোড করা (বা ডেটা URL থেকে এক্সট্র্যাক্ট করা)
        image_data = None
        mime_type = None
        
        if image_url.startswith('data:'):
            # Data URL from Baileys decrypted media
            print(f"✅ [DEBUG] Detected data URL (Baileys decrypted media). Extracting base64...")
            try:
                # Parse: data:image/jpeg;base64,/9j/4AAQSkZJRgABA...
                header, b64_data = image_url.split(',', 1)
                mime_type = header.split(';')[0].replace('data:', '')
                image_data = base64.b64decode(b64_data)
                print(f"✅ [DEBUG] Extracted from data URL. MIME: {mime_type}, Size: {len(image_data)} bytes")
            except Exception as e:
                print(f"❌ [DEBUG] Failed to parse data URL: {e}")
                return None
        else:
            # Regular URL - download normally
            print(f"[DEBUG] Downloading image from URL...")
            img_response = requests.get(image_url, timeout=10)
            img_response.raise_for_status()
            
            image_data = BytesIO(img_response.content).read()
            print(f"[DEBUG] Image downloaded successfully. Size: {len(image_data)} bytes")

            # Get MIME type from response header
            mime_type = img_response.headers.get('content-type', '').split(';')[0].strip()
            print(f"[DEBUG] MIME type from response header: {mime_type}")
        
        # If MIME type is missing or generic, detect from magic bytes
        if not mime_type or mime_type == 'application/octet-stream' or not mime_type.startswith('image/'):
            detected_mime, detection_method = detect_image_format_from_bytes(image_data)
            print(f"[DEBUG] MIME type detected from {detection_method}: {detected_mime}")
            mime_type = detected_mime
        else:
            print(f"[DEBUG] Using MIME type: {mime_type}")

        # ৪. প্রম্পট তৈরি করা (SMART structured prompt for DB-ready caption)
        prompt = (
            "Analyze this product image and extract key details for a search database. "
            "Format the response in a short descriptive sentence including: "
            "1. Product Category (e.g., Electronics, Clothing, Grocery), "
            "2. Name or Title, "
            "3. Brand/Model (if visible, otherwise skip), "
            "4. Primary Color, "
            "5. One unique visual identifier (e.g., texture, shape, pattern, or logo) "
            "that makes it distinct from similar items."
        )

        # ৫. মডেল কল করা (ইমেজ বাইটস সহ - proper SDK types)
        print(f"[DEBUG] Calling Gemini Vision API with image data...")
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                types.Part.from_bytes(data=image_data, mime_type=mime_type)
            ],
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=100
            )
        )

        print(f"[DEBUG] API Response object: {response}")
        print(f"[DEBUG] Response type: {type(response)}")
        
        caption = response.text.strip() if getattr(response, 'text', None) else None
        if caption:
            print(f"✅ [DEBUG] Generated Image Caption: {caption[:120]}")
            print(f"--- [DEBUG] Image Caption Process Finished ---\n")
            return caption
        else:
            print(f"❌ [DEBUG] No caption generated (empty response). Response text attr: {getattr(response, 'text', 'NO TEXT ATTR')}")
            return None
            
    except requests.exceptions.RequestException as e:
        import traceback
        print(f"❌ Image Download Error: {e}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return None
    except Exception as e:
        import traceback
        print(f"❌ Image Caption API Error: {e}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return None


def get_openai_image_caption(image_url):
    print(f"--- [DEBUG] Starting OpenAI Image Caption Process ---")
    print(f"[DEBUG] Image URL: {image_url}")

    if not image_url or not isinstance(image_url, str):
        print(f"[DEBUG] Error: Invalid image URL for OpenAI caption generation.")
        return None

    try:
        from openai import OpenAI
    except ImportError as e:
        print(f"OpenAI SDK not installed: {e}")
        return None

    try:
        # ১. ইমেজ ডাউনলোড করা (বা ডেটা URL থেকে এক্সট্র্যাক্ট করা)
        image_data = None
        mime_type = None
        data_url = None
        
        if image_url.startswith('data:'):
            # Data URL from Baileys decrypted media
            print(f"[DEBUG] Detected data URL (Baileys decrypted media). Using directly...")
            data_url = image_url
            # Extract MIME type for logging
            try:
                mime_type = image_url.split(';')[0].replace('data:', '')
                print(f"[DEBUG] MIME type from data URL: {mime_type}")
            except:
                pass
        else:
            # Regular URL - download normally
            print(f"[DEBUG] Downloading image from URL...")
            img_response = requests.get(image_url, timeout=10)
            img_response.raise_for_status()
            
            # २. ইমেজ ডেটা বাইটস হিসেবে লোড করা
            image_data = BytesIO(img_response.content).read()
            print(f"[DEBUG] Image downloaded successfully. Size: {len(image_data)} bytes")

            # 3. MIME type detection: Try response header first, then magic bytes (most reliable)
            mime_type = img_response.headers.get('content-type', '').split(';')[0].strip()
            print(f"[DEBUG] MIME type from response header: {mime_type}")
            
            # If header is missing or generic, detect from magic bytes (most reliable)
            if not mime_type or mime_type == 'application/octet-stream' or not mime_type.startswith('image/'):
                mime_type, detection_method = detect_image_format_from_bytes(image_data)
                print(f"[DEBUG] MIME type detected from {detection_method}: {mime_type}")
            else:
                print(f"[DEBUG] Using MIME type from header: {mime_type}")

            # ४. बाइट्स कو base64 में कनवर्ट करा
            image_base64 = base64.b64encode(image_data).decode('utf-8')
            print(f"[DEBUG] Converted image to base64. Length: {len(image_base64)} characters")

            # ५. डेटा URL बनाना (base64 एन्कोडेड)
            data_url = f"data:{mime_type};base64,{image_base64}"
            print(f"[DEBUG] Created data URL for OpenAI")

        # ६. प्रॉम्प्ट बनाना (SMART structured prompt for DB-ready caption)
        prompt = (
            "Analyze this product image and extract key details for a search database. "
            "Format the response in a short descriptive sentence including: "
            "1. Product Category (e.g., Electronics, Clothing, Grocery), "
            "2. Name or Title, "
            "3. Brand/Model (if visible, otherwise skip), "
            "4. Primary Color, "
            "5. One unique visual identifier (e.g., texture, shape, pattern, or logo) "
            "that makes it distinct from similar items."
        )

        # ७. OpenAI API कॉल करा (डेटा URL सह)
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        print(f"[DEBUG] Calling OpenAI Vision API with image data...")

        response = client.chat.completions.create(
            model='gpt-4o',
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': data_url}}
                    ]
                }
            ],
            temperature=0.3,
            max_tokens=100,
        )

        caption = response.choices[0].message.content.strip() if response.choices else None

        if caption:
            print(f"✅ [DEBUG] Generated Image Caption: {caption[:120]}")
            print(f"--- [DEBUG] Image Caption Process Finished ---\n")
            return caption
        else:
            print(f"❌ [DEBUG] No caption generated (empty response). Choices: {response.choices}")
            return None
            
    except requests.exceptions.RequestException as e:
        import traceback
        print(f"❌ Image Download Error: {e}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return None
    except Exception as e:
        import traceback
        print(f"❌ Image Caption API Error: {e}")
        print(f"Traceback:\n{traceback.format_exc()}")
        return None



def get_image_caption(image_url, provider='gemini'):
    print(f"\n[DEBUG] get_image_caption() called with provider='{provider}'")
    if provider and str(provider).lower() == 'openai':
        print(f"[DEBUG] Using OpenAI provider for caption generation")
        return get_openai_image_caption(image_url)
    print(f"[DEBUG] Using Gemini provider for caption generation (default or explicit)")
    return get_gemini_image_caption(image_url)

import re
from embedding.models import DocumentKnowledge
def _get_image_bytes_from_source(image_url: str):
    """Accepts a data URL or HTTP(S) URL, returns bytes and mime if possible."""
    if not image_url or not isinstance(image_url, str):
        return None, None

    if image_url.startswith('data:'):
        try:
            header, b64 = image_url.split(',', 1)
            mime = header.split(';')[0].replace('data:', '')
            data = base64.b64decode(b64)
            return data, mime
        except Exception:
            return None, None

    # normal URL
    try:
        r = requests.get(image_url, timeout=10)
        r.raise_for_status()
        data = r.content
        mime = r.headers.get('content-type', '').split(';')[0].strip() or None
        return data, mime
    except Exception:
        return None, None


def get_gemini_image_caption(image_url: str):
    """Simple image caption: detects format and returns brief description."""
    image_data, mime = _get_image_bytes_from_source(image_url)
    if not image_data:
        logger.debug(f"get_gemini_image_caption: no image data from {image_url}")
        return None

    detected_mime, method = detect_image_format_from_bytes(image_data)
    mime = mime or detected_mime

    # Try PIL for size/mode
    info = None
    if Image:
        try:
            img = Image.open(BytesIO(image_data))
            info = f"{img.format}, {img.width}x{img.height}, {img.mode}"
        except Exception:
            pass

    if not info:
        info = f"{mime} (unknown size)"

    caption = f"Image ({info})"
    logger.debug(f"get_gemini_image_caption: {caption} via {method}")
    return caption


def get_openai_image_caption(image_url: str):
    """Alias to Gemini caption for now; accepts data URLs."""
    # Reuse the simple caption logic to ensure media flow works
    return get_gemini_image_caption(image_url)

import re
from embedding.models import DocumentKnowledge

def chunk_text(text, max_words=100, overlap=20):
    """
    Splits a large text into smaller chunks with word overlap.
    """
    words = text.split()
    chunks = []
    
    if len(words) <= max_words:
        return [text]
        
    for i in range(0, len(words), max_words - overlap):
        chunk = " ".join(words[i : i + max_words])
        if chunk:
            chunks.append(chunk)
            
    return chunks


def get_hash(text):
    """টেক্সট থেকে ইউনিক MD5 হাশ তৈরি করে"""
    return hashlib.md5(text.encode('utf-8')).hexdigest()
    
    
def process_document_text(user, text, document):
    """
    Take generic text, chunk it, embed and save it.
    """
    print(f"\n--- [DEBUG] Processing Document '{document.title}' for {user.email} ---")
    
    
    document.full_content = text 
    document.save()
    
    # ১. টেক্সট ক্লিন করা
    clean_text = re.sub(r'\s+', ' ', text).strip()
    if not clean_text:
        document.chunks.all().delete()
        return 0
        
    # ২. চাঙ্ক বানানো
    chunks = chunk_text(clean_text, max_words=150, overlap=30)
    
    # ৩. ডাটাবেসে বর্তমানে কী কী চাঙ্ক আছে তার একটা লিস্ট নেওয়া
    existing_chunks = DocumentKnowledge.objects.filter(document=document)
    hash_map = {c.content_hash: c for c in existing_chunks}
    
    processed_hashes = []
    new_saved = 0
    skipped = 0

    for i, content in enumerate(chunks):
        c_hash = get_hash(content)
        processed_hashes.append(c_hash)
        
        if c_hash in hash_map:
            # যদি হাশ মিলে যায়, তবে এম্বেড করার দরকার নেই, শুধু ইনডেক্স আপডেট করো
            obj = hash_map[c_hash]
            obj.chunk_index = i # পজিশন চেঞ্জ হতে পারে
            obj.save()
            skipped += 1
        else:
            # নতুন ডাটা বা আপডেট হওয়া ডাটা - এম্বেড করো
            vector = get_gemini_embedding(content)
            if vector:
                DocumentKnowledge.objects.create(
                    user=user,
                    document=document,
                    doc_title=document.title,
                    chunk_index=i,
                    content=content,
                    content_hash=c_hash,
                    embedding=list(vector)
                )
                new_saved += 1
    
    # ৪. যে চাঙ্কগুলো এখন আর লেখায় নেই (ডিলিট করা হয়েছে), সেগুলো ডাটাবেস থেকে মুছে ফেলো
    DocumentKnowledge.objects.filter(document=document).exclude(content_hash__in=processed_hashes).delete()
    
    print(f"--- [DEBUG] Finished. New: {new_saved}, Skipped: {skipped} ---")
    return new_saved





# def prepare_headers(grid_data):
#     """
#     grid_data থেকে Row 0 এর কলাম নামগুলো একটি ডিকশনারি হিসেবে দেয়।
#     আউটপুট উদাহরণ: {"0": "Product", "1": "Model", "2": "Price"}
#     """
#     headers = {}
#     for key, value in grid_data.items():
#         if key.startswith('0-'):  # শুধু প্রথম রো (Row 0) চেক করবে
#             parts = key.split('-')
#             if len(parts) == 2:
#                 col_idx = parts[1]
#                 # কলামের নাম থেকে স্টার (*) এবং অপ্রয়োজনীয় স্পেস বাদ দিবে
#                 headers[col_idx] = str(value).replace("*", "").strip()
#     return headers





# def smart_row_update(user, grid_data):
#     #<!--------------- header create ----------------!>
#     headers = {
#         k.split('-')[1]: str(v).replace("*", "").strip() 
#         for k, v in grid_data.items() if k.startswith('0-')
#     }

#     rows = {}
#     for k, v in grid_data.items():
#         if '-' not in k or k.startswith('0-'): continue
#         r_idx, c_idx = k.split('-')
#         if r_idx not in rows: rows[r_idx] = {}
#         rows[r_idx][c_idx] = str(v).strip()

#     updated_count = 0

#     for r_idx, cols in rows.items():
#         # প্রতিটি কলামের ভ্যালু দিয়ে একটি ইউনিক হ্যাস তৈরি
#         new_col_hashes = {c: hashlib.md5(val.encode()).hexdigest() for c, val in cols.items()}
        
#         # ডাটাবেস চেক
#         obj, created = SpreadsheetKnowledge.objects.get_or_create(
#             user=user, 
#             row_id=f"row_{r_idx}", 
#             defaults={'column_hashes': {}, 'content': ''}
#         )

#         if created or obj.column_hashes != new_col_hashes:
#             print(f"[DEBUG] Row {r_idx} changed or new. Updating...")
            
#             # বাক্য তৈরি: "Product: nokia, Price: 4444"
#             row_text = ", ".join([f"{headers.get(c, 'Field_'+c)}: {v}" for c, v in cols.items()])
            
#             # Gemini এমবেডিং
#             vector = get_gemini_embedding(row_text)
#             if vector:
#                 obj.content = row_text
#                 obj.column_hashes = new_col_hashes
#                 obj.embedding = vector
#                 obj.save()
#                 updated_count += 1
#         else:
#             print(f"[DEBUG] Row {r_idx} matches existing data. Skipping Gemini.")

#     return updated_count

    


















