import re
import html
from django.utils.html import strip_tags

def clean_product_description_for_ai(raw_text):
    """
    Cleans rich text (HTML / Word-like formatting / Markdown artifacts)
    from product descriptions so AI prompts, RAG search documents,
    and chat responses receive clean, natural, readable plain text
    without HTML tags, markdown symbols, or escaped entities.
    """
    if not raw_text:
        return ""
    
    text = str(raw_text)
    
    # 1. Normalize line break and list tags to readable plain-text equivalents
    text = re.sub(r'<br\s*/?>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</p\s*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</div\s*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<li[^>]*>', '• ', text, flags=re.IGNORECASE)
    text = re.sub(r'</li\s*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'<h[1-6][^>]*>', '\n', text, flags=re.IGNORECASE)
    text = re.sub(r'</h[1-6]\s*>', '\n', text, flags=re.IGNORECASE)
    
    # 2. Strip remaining HTML tags
    text = strip_tags(text)
    
    # 3. Unescape HTML entities (e.g., &amp; -> &, &nbsp; -> space, etc.)
    text = html.unescape(text)
    text = text.replace('\xa0', ' ')
    
    # 4. Remove leftover markdown / rich syntax markers (*, _, ~, #, `)
    text = re.sub(r'[*_~`#]', '', text)
    
    # 5. Clean up duplicate blank lines & whitespace
    lines = [line.strip() for line in text.splitlines()]
    clean_lines = []
    prev_blank = False
    for line in lines:
        if not line:
            if not prev_blank:
                clean_lines.append("")
                prev_blank = True
        else:
            clean_lines.append(line)
            prev_blank = False
            
    return "\n".join(clean_lines).strip()
