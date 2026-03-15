import re
import os
import json
from django.conf import settings
from chat.models import Message
from aiAgent.models import UserMemory
from aiAgent.memory_service import extract_and_update_memory

def load_skip_keywords():
    path = os.path.join(settings.BASE_DIR, 'webhooks', 'history_skip_keywords.json')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return []

SKIP_KEYWORDS = load_skip_keywords()

def calculate_context_score(text):
    """
    Calculates a 'context score' (0-15+) based on the information density.
    """
    score = 0
    text_lower = text.lower()

    if re.search(r'\b01[3-9]\d{8}\b', text): score += 5
    if re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text): score += 4
    
    locations = ['ঢাকা', 'dhaka', 'চট্টগ্রাম', 'মিরপুর', 'উত্তরা', 'mirpur', 'uttara', 'বনানী', 'banani', 'গুলশান', 'gulshan']
    if any(loc in text_lower for loc in locations): score += 4

    intents = ['অর্ডার', 'order', 'কিনবো', 'লাগবে', 'চাই', 'প্রয়োজন', 'ঠিকানা', 'address', 'নিবো', 'দাম']
    if any(intent in text_lower for intent in intents): score += 3

    urgency_words = ['খারাপ', 'বাজে', 'দেরি', 'স্লো', 'সমস্যা', 'issue', 'problem', 'slow', 'urgent', 'জরুরি']
    if any(u in text_lower for u in urgency_words): score += 5

    if len(text) > 100: score += 4
    elif len(text) > 40: score += 2

    return score

def handle_smart_memory_update(agent_config, sender, current_text):
    text_clean = current_text.lower().strip()
    
    # --- Layer 1: Smart Skip Check ---
    is_skip = False
    skip_margin = 2
    for kw in SKIP_KEYWORDS:
        if kw.lower() in text_clean and abs(len(text_clean) - len(kw)) <= skip_margin:
            is_skip = True
            break
            
    if is_skip:
        return # [Layer 1] Silently skip routine greetings

    # --- Layer 2 & 3: Accumulation & Triggering ---
    memory, _ = UserMemory.objects.get_or_create(ai_agent=agent_config, sender_id=sender)
    
    # Initialize internal state if missing
    if '_internal' not in memory.data:
        memory.data['_internal'] = {
            'accumulated_score': 0,
            'unskipped_count': 0,
            'unskipped_buffer': []
        }
    
    internal = memory.data['_internal']
    score = calculate_context_score(current_text)
    
    # Update counters
    internal['accumulated_score'] += score
    internal['unskipped_count'] += 1
    internal['unskipped_buffer'].append(f"User: {current_text}")
    
    # Maintenance: Limit buffer size
    if len(internal['unskipped_buffer']) > 30:
        internal['unskipped_buffer'].pop(0)

    should_call = False
    reason = ""

    # Layer 2: High Score Threshold
    if internal['accumulated_score'] >= 10:
        should_call = True
        reason = f"High Context Density ({internal['accumulated_score']})"
    
    # Layer 3: Unskipped Message Cycle
    elif internal['unskipped_count'] >= 20:
        should_call = True
        reason = "Periodic Hybrid Summary (20 Unskipped Messages)"

    if should_call:
        # Only unskipped messages go to AI
        chat_history = "\n".join(internal['unskipped_buffer'])
        try:
            print(f"🧠 >>> Hybrid Extraction Triggered for {sender} ({reason})")
            extract_and_update_memory(agent_config, sender, chat_history)
            
            # Reset accumulation after successful sync
            internal['accumulated_score'] = 0
            internal['unskipped_count'] = 0
            internal['unskipped_buffer'] = []
        except Exception as e:
            print(f"Hybrid Intelligence sync failed: {str(e)}")

    memory.save()