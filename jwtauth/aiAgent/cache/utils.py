import re

def normalize_text(text):
    
    text = text.lower().strip()
    text = re.sub(r'\s+', ' ', text)
    text = re.sub(r'[^\w\s\u0980-\u09FF\u0600-\u06FF]', '', text)
    return text