from google import genai
from django.conf import settings
import hashlib
from embedding.models import SpreadsheetKnowledge

client = genai.Client(api_key=settings.GEMINI_API_KEY)






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

def sync_spreadsheet_to_knowledge(user, grid_data):
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
    for k, v in grid_data.items():
        if '-' not in k or k.startswith('0-'): continue
        r_idx, c_idx = k.split('-')
        if r_idx not in rows: rows[r_idx] = {}
        rows[r_idx][c_idx] = str(v).strip()

    updated_count = 0

    for r_idx, cols in rows.items():
        # ৩. ডাটা স্ট্রিং তৈরির সময় কলাম আইডি সর্ট করা বাধ্যতামূলক
        sorted_cols = sorted(cols.keys())
        data_content = "|".join([f"{c}:{cols[c]}" for c in sorted_cols])
        
        # কম্বাইন্ড হ্যাশ: ডাটা + হেডার হ্যাশ
        combined_hash = hashlib.md5((data_content + header_hash).encode()).hexdigest()
        
        obj, created = SpreadsheetKnowledge.objects.get_or_create(
            user=user, 
            row_id=f"row_{r_idx}", 
            defaults={'column_hashes': {}, 'content': ''}
        )

        # ৪. ডাটাবেসের হ্যাশ চেক
        old_hash = obj.column_hashes.get('combined_hash')

        if created or old_hash != combined_hash:
            print(f"[DEBUG] Row {r_idx} Changed! Updating...")
            
            # কন্টেন্ট তৈরি (সর্টেড অর্ডারে)
            row_text = ", ".join([f"{headers.get(c, f'col_{c}')}: {cols[c]}" for c in sorted_cols])
            
            vector = get_gemini_embedding(row_text)
            if vector:
                obj.content = row_text
                obj.column_hashes = {'combined_hash': combined_hash}
                obj.embedding = vector
                obj.save()
                updated_count += 1
        else:
            print(f"[DEBUG] Row {r_idx} No change. Skipping.")

    return updated_count







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

    


















