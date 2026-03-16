import re
import os
import json
from django.conf import settings
from django.core.cache import cache
from chat.models import Message
from aiAgent.models import UserMemory, SmartKeyword
from aiAgent.memory_service import extract_and_update_memory

# --- Advanced Keyword Caching ---
def get_keywords_by_category(category):
    """
    Fetches keywords from cache or DB.
    """
    cache_key = f"smart_keywords_{category}"
    keywords = cache.get(cache_key)
    
    if keywords is None:
        try:
            keywords = list(SmartKeyword.objects.filter(category=category, is_active=True).values_list('text', flat=True))
            cache.set(cache_key, keywords, 600) # Cache for 10 minutes
        except:
            # Fallback for when migrations haven't run yet or DB error
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
    
    # 2. Location Check (from DB)
    locations = get_keywords_by_category('location')
    for loc in locations:
        if loc.lower() in text_lower:
            score += 4
            matches.append(f"Location: {loc} (+4)")
            break

    # 3. Intent Check (from DB)
    intents = get_keywords_by_category('intent')
    for intent in intents:
        if intent.lower() in text_lower:
            score += 3
            matches.append(f"Intent: {intent} (+3)")
            break

    # 4. Urgency/Sentiment Check (from DB)
    urgency = get_keywords_by_category('urgency')
    for u in urgency:
        if u.lower() in text_lower:
            score += 5
            matches.append(f"Urgency: {u} (+5)")
            break

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
    
    # --- Layer 1: Smart Skip Check (from DB) ---
    skip_keywords = get_keywords_by_category('skip')
    history_skip = get_keywords_by_category('history_skip')
    embedding_skip = get_keywords_by_category('embedding_skip')
    
    all_skip_keywords = skip_keywords + history_skip + embedding_skip
    
    is_skip = False
    skip_margin = 2
    for kw in all_skip_keywords:
        if kw.lower() in text_clean and abs(len(text_clean) - len(kw)) <= skip_margin:
            is_skip = True
            break
            
    if is_skip:
        return 

    # --- Layer 2 & 3: Accumulation & Triggering ---
    memory, _ = UserMemory.objects.get_or_create(ai_agent=agent_config, sender_id=sender)
    
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
            
            internal['accumulated_score'] = 0
            internal['unskipped_count'] = 0
            internal['unskipped_buffer'] = []
        except Exception as e:
            print(f"Hybrid Intelligence sync failed: {str(e)}")

    memory.save()