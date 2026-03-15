import json
import os

def load_keywords(filename, default_value=None):
    """Helper to load keywords from JSON file."""
    if default_value is None:
        default_value = []
    
    file_path = os.path.join(os.path.dirname(__file__), filename)
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading {filename}: {e}")
    return default_value

TARGET_KEYWORDS = load_keywords('target_keywords.json')
embedding_skip_keyword = load_keywords('embedding_skip_keywords.json')
history_skip_keyword = load_keywords('history_skip_keywords.json')