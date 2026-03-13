from google import genai
from django.conf import settings
import hashlib
from embedding.models import SpreadsheetKnowledge
import logging


client = genai.Client(api_key=settings.GEMINI_API_KEY)

logger = logging.getLogger('aiAgent')




def get_gemini_embedding(text):

    print(f"\n--- [DEBUG] Starting Embedding Process ---")
    print(f"[DEBUG] Input Text: {text[:100]}...")

    if not text or not isinstance(text, str):
        print(f"[DEBUG] Error: Invalid input text.")
        return None

    try:
        response = client.models.embed_content(
            model='models/gemini-embedding-001', 
            contents=text,
            config={
                'output_dimensionality': 768
            }
        )

        embedding_values = response.embeddings[0].values
        print(f"[DEBUG] Success! Vector Length: {len(embedding_values)}")
        print(f"[DEBUG] First 5 values: {embedding_values[:5]}")
        print(f"--- [DEBUG] Embedding Process Finished ---\n")
        return embedding_values
    except Exception as e:
        print(f"Embedding API Error: {e}")
        return None
    


import hashlib


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
        
        # ইউনিক রো আইডি (যেমন: sheet_1_row_1)
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
        # ৪. ডাটা স্ট্রিং এবং কম্বাইন্ড হ্যাশ
        sorted_cols = sorted(cols.keys())
        data_content = "|".join([f"{c}:{cols[c]}" for c in sorted_cols])
        combined_hash = hashlib.md5((data_content + header_hash).encode()).hexdigest()
        
        row_unique_id = f"sheet_{sheet_id}_row_{r_idx}"
        obj, created = SpreadsheetKnowledge.objects.get_or_create(
            user=user, 
            row_id=row_unique_id,
            defaults={'column_hashes': {}, 'content': ''}
        )
        
        # ৪. ডাটাবেসের হ্যাশ চেক
        old_hash = obj.column_hashes.get('combined_hash')

        # ৫. শুধু পরিবর্তন হলেই আপডেট হবে (Saving API Costs)
        if created or old_hash != combined_hash:
            # 🔥 পরিবর্তন এখানে: শুধু যেসব কলামে ডাটা আছে (Empty নয়) সেগুলো ফিল্টার করা
            row_text_parts = []
            for c in sorted_cols:
                col_val = cols[c].strip()
                if col_val and col_val.lower() != 'none': # খালি বা 'none' হলে বাদ
                    header_name = headers.get(c, f'col_{c}')
                    row_text_parts.append(f"{header_name}: {col_val}")
            
            # সব পার্টস জোড়া দিয়ে ফাইনাল টেক্সট
            row_text = ", ".join(row_text_parts)
            
            # যদি কন্টেন্ট থাকে তবেই সেভ হবে, নাহলে ডিলিট/স্কিপ
            if row_text.strip():
                try:
                    vector = get_gemini_embedding(row_text)
                    if vector:
                        obj.content = row_text
                        obj.column_hashes = {'combined_hash': combined_hash}
                        obj.embedding = vector
                        obj.save()
                        updated_count += 1
                except Exception as e:
                    print(f"Error: {e}")
            else:
                # যদি রো-তে কোনো কাজের তথ্যই না থাকে তবে ডাটাবেস থেকে মুছে ফেলুন
                obj.delete()
        else:
            print(f"[DEBUG] Row {r_idx} No change. Skipping.")

    return updated_count

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

    


















