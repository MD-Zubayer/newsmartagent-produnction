import re
import os
import json
from django.conf import settings
from django.core.cache import cache
from chat.models import Message
from aiAgent.models import UserMemory, SmartKeyword
from aiAgent.memory_service import extract_and_update_memory

# --- Advanced Keyword Caching ---
def extract_possible_keywords(text, max_n=5):
    """
    Generates all possible sub-phrases (n-grams) from the text.
    Example: "dhaka jabo" -> ["dhaka", "jabo", "dhaka jabo"]
    """
    words = re.findall(r'\b\w+\b', text.lower())
    ngrams = []
    for n in range(1, max_n + 1):
        for i in range(len(words) - n + 1):
            ngrams.append(" ".join(words[i:i+n]))
    return list(set(ngrams))

def check_keyword_match(text, category):
    """
    Checks if any keyword from the given category exists in the text
    using an optimized DB-indexed lookup.
    """
    if not text:
        return []
    
    ngrams = extract_possible_keywords(text)
    if not ngrams:
        return []

    return list(SmartKeyword.objects.filter(
        category=category, 
        is_active=True, 
        text__in=ngrams
    ).values_list('text', flat=True))

def get_keywords_by_category(category):
    """
    (Deprecated) Fetches all keywords for a category. Use check_keyword_match for scale.
    """
    cache_key = f"smart_keywords_{category}"
    keywords = cache.get(cache_key)
    
    if keywords is None:
        try:
            keywords = list(SmartKeyword.objects.filter(category=category, is_active=True).values_list('text', flat=True))
            cache.set(cache_key, keywords, 600)
        except:
            keywords = []
            
    return keywords

def calculate_context_score(text):
    """
    Calculates a 'context score' (0-15+) based on DB-backed keywords.
    """
    score = 0
    text_lower = text.lower()
    matches = []

    # 1. Regex Patterns (Highest importance)
    if re.search(r'\b01[3-9]\d{8}\b', text): 
        score += 5
        matches.append("Phone Number (+5)")
    if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text): 
        score += 4
        matches.append("Email (+4)")
    
    # 2. Location Check (from DB - Optimized)
    locations = check_keyword_match(text, 'location')
    if locations:
        score += 4
        matches.append(f"Location: {locations[0]} (+4)")

    # 3. Intent Check (from DB - Optimized)
    intents = check_keyword_match(text, 'intent')
    if intents:
        score += 3
        matches.append(f"Intent: {intents[0]} (+3)")

    # 4. Urgency/Sentiment Check (from DB - Optimized)
    urgency = check_keyword_match(text, 'urgency')
    if urgency:
        score += 5
        matches.append(f"Urgency: {urgency[0]} (+5)")

    # 5. Complexity
    if len(text) > 100: 
        score += 4
        matches.append("High Complexity (+4)")
    elif len(text) > 40: 
        score += 2
        matches.append("Medium Complexity (+2) ")

    print(f"📊 Context Score for '{text[:30]}...': {score} | Matches: {matches}")
    return score

def handle_smart_memory_update(agent_config, sender, current_text):
    text_clean = current_text.lower().strip()
    
    # --- Layer 1: Smart Skip Check (from DB - Optimized) ---
    is_skip = False
    for cat in ['skip', 'history_skip', 'embedding_skip']:
        matched = check_keyword_match(current_text, cat)
        if matched:
            is_skip = True
            break
            
    if is_skip:
        return 

    # --- Layer 2 & 3: Accumulation & Triggering ---
    memory, _ = UserMemory.objects.get_or_create(ai_agent=agent_config, sender_id=sender)
    
    if not isinstance(memory.data, dict):
        memory.data = {}
        
    if '_internal' not in memory.data:
        memory.data['_internal'] = {
            'accumulated_score': 0,
            'unskipped_count': 0,
            'unskipped_buffer': []
        }
    
    internal = memory.data['_internal']
    score = calculate_context_score(current_text)
    
    internal['accumulated_score'] += score
    internal['unskipped_count'] += 1
    internal['unskipped_buffer'].append(f"User: {current_text}")
    
    if len(internal['unskipped_buffer']) > 30:
        internal['unskipped_buffer'].pop(0)

    should_call = False
    reason = ""

    if internal['accumulated_score'] >= 10:
        should_call = True
        reason = f"High Context Density ({internal['accumulated_score']})"
    elif internal['unskipped_count'] >= 20:
        should_call = True
        reason = "Periodic Hybrid Summary (20 Unskipped Messages)"

    if should_call:
        chat_history = "\n".join(internal['unskipped_buffer'])
        try:
            print(f"🚀 >>> Hybrid Extraction Triggered for {sender} ({reason})")
            extract_and_update_memory(agent_config, sender, chat_history)
            
            # CRITICAL: Refresh from DB because extract_and_update_memory saved new keys
            memory.refresh_from_db()
            internal = memory.data.get('_internal', {})
            
            internal['accumulated_score'] = 0
            internal['unskipped_count'] = 0
            internal['unskipped_buffer'] = []
            memory.data['_internal'] = internal
        except Exception as e:
            print(f"Hybrid Intelligence sync failed: {str(e)}")

    memory.save()