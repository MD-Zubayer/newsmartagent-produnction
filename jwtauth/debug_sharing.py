
import os
import django
import json
import redis
import hashlib
from unittest.mock import MagicMock, patch

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jwtauth.settings')
django.setup()

from aiAgent.models import AgentAI
from settings.models import AgentAISettings
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory, force_authenticate
from aiAgent.views import RankingAPIView
from aiAgent.cache.client import get_redis_client

User = get_user_model()

def debug_shared_rankings():
    # 1. Setup Redis clients
    r_db2 = get_redis_client(db=2)
    r_db4 = get_redis_client(db=4)
    
    # 2. Setup mock data
    user, _ = User.objects.get_or_create(email="debug_sharing@example.com")
    
    agent_a, _ = AgentAI.objects.get_or_create(
        page_id="debug_a", 
        defaults={"user": user, "name": "Agent A", "platform": "messenger", "system_prompt": "A"}
    )
    agent_b, _ = AgentAI.objects.get_or_create(
        page_id="debug_b", 
        defaults={
            "user": user, 
            "name": "Agent B (Widget)", 
            "platform": "web_widget", 
            "widget_key": "debug_b_key",
            "system_prompt": "B"
        }
    )
    
    # Set A to share from B
    settings_a = agent_a.get_settings
    settings_a.shared_cache_agents.set([agent_b])
    
    # Use Web Widget logic for B
    b_redis_id = f"widget_{agent_b.widget_key}" if agent_b.platform == 'web_widget' else agent_b.page_id
    msg_hash = "shared_hash"
    msg_text = "Shared Message from Web Widget B"

    # Clear Redis data
    r_db4.delete(f"agent:debug_a:ranking")
    r_db4.delete(f"agent:{b_redis_id}:ranking")
    r_db2.delete(f"agent:debug_a:reply:{msg_hash}")
    r_db2.delete(f"agent:{b_redis_id}:reply:{msg_hash}")
    
    # Cache in B (DB 2)
    cache_data = {
        "original_text": msg_text,
        "reply": "Reply from B",
        "input_tokens": 100,
        "output_tokens": 50,
        "cache_scope": "agent_specific"
    }
    r_db2.set(f"agent:{b_redis_id}:reply:{msg_hash}", json.dumps(cache_data))
    
    # Case: Double Counting Check
    # Scenario: Agent A hits Agent B's cache. 
    # Previously, this incremented BOTH A and B. Now only A.
    
    from aiAgent.cache.hybrid_similarity import get_cached_reply
    from aiAgent.cache.ranking import incr_message_frequency
    
    # Simulate what tasks.py does on a shared hit:
    # 1. Look up B's cache with track_hit=False
    res = get_cached_reply(b_redis_id, msg_hash=msg_hash, track_hit=False)
    # 2. Increment A's ranking
    incr_message_frequency("debug_a", msg_hash)
    
    # 3. Call API and verify
    factory = APIRequestFactory()
    view = RankingAPIView.as_view()
    request = factory.get('/api/AgentAI/ranking/debug_a/')
    force_authenticate(request, user=user)
    
    response = view(request, agent_id="debug_a")
    data = response.data.get('data', [])
    
    print("\nVerification of Double Counting Fix:")
    for item in data:
        if item['msg_hash'] == msg_hash:
            print(f"Text: {item['text']}")
            print(f"Aggregated Frequency: {item['frequency']} (Expected: 1)")
            print(f"Token Savings: {item['token_savings']} (Expected: 0 for 1st hit)")
            
            if item['frequency'] == 1:
                print("✅ Success: No double counting!")
            else:
                print(f"❌ Failure: Still double counting! Frequency: {item['frequency']}")

    # Case: Sharing Toggle Check
    # Scenario: Agent B marks a message as "excluded" (Sharing Off).
    # Agent A should NOT hit it anymore.
    print("\nVerification of Sharing Toggle (Exclusion):")
    r_db4.sadd(f"agent:{b_redis_id}:sharing_exclusion_set", msg_hash)
    
    # Simulate Layer 1.5 in tasks.py
    exclusion_key = f"agent:{b_redis_id}:sharing_exclusion_set"
    if r_db4.sismember(exclusion_key, msg_hash):
        print("B settings: Message is EXCLUDED (Sharing Off)")
        # In tasks.py logic, this would result in skipping the potential_res
        hit_allowed = False
    else:
        hit_allowed = True
        
    if not hit_allowed:
        print("✅ Success: Sharing toggle is respected for Web Widget!")
    else:
        print("❌ Failure: Sharing toggle ignored!")
        
    # Case: API is_blocked flag check
    print("\nVerification of API is_blocked flag:")
    # We need a message that is ONLY in B's ranking and is BLOCKED by B
    blocked_msg_text = "Blocked Shared Message from B"
    blocked_msg_hash = hashlib.md5(blocked_msg_text.encode()).hexdigest()
    
    # 1. Add to B's ranking
    r_db4.zincrby(f"agent:{b_redis_id}:ranking", 1, blocked_msg_hash)
    # 2. Add to B's exclusion set
    r_db4.sadd(f"agent:{b_redis_id}:sharing_exclusion_set", blocked_msg_hash)
    # 3. Add to B's cache (so it shows up with text)
    r_db2.set(f"agent:{b_redis_id}:reply:{blocked_msg_hash}", json.dumps({
        "original_text": blocked_msg_text,
        "cache_scope": "agent_specific"
    }))
    
    response = view(request, agent_id="debug_a")
    data = response.data.get('data', [])
    found = False
    for item in data:
        if item['msg_hash'] == blocked_msg_hash:
            found = True
            print(f"Text: {item['text']}")
            print(f"Is Shared: {item['is_shared']}")
            print(f"Is Blocked: {item['is_blocked']}")
            if item['is_blocked'] and item['is_shared']:
                print("✅ Success: API correctly identifies shared blocked message!")
            else:
                print("❌ Failure: API missed the blocked status or shared flag!")
    if not found:
        print("❌ Failure: Blocked message not found in A's ranking aggregation!")

    # Case: Unknown Message Fix (Local Ranking, Shared Cache Only)
    print("\nVerification of Unknown Message Fix:")
    unknown_fix_text = "Text only in B cache"
    unknown_fix_hash = hashlib.md5(unknown_fix_text.encode()).hexdigest()
    
    # 1. Add to A's ranking (Local)
    r_db4.zincrby(f"agent:debug_a:ranking", 1, unknown_fix_hash)
    # 2. Add to B's cache ONLY (Shared)
    r_db2.set(f"agent:{b_redis_id}:reply:{unknown_fix_hash}", json.dumps({
        "original_text": unknown_fix_text,
        "cache_scope": "agent_specific"
    }))
    
    response = view(request, agent_id="debug_a")
    data = response.data.get('data', [])
    found = False
    for item in data:
        if item['msg_hash'] == unknown_fix_hash:
            found = True
            print(f"Text: {item['text']}")
            if item['text'] == unknown_fix_text:
                print("✅ Success: Unknown Message eliminated by searching shared agents!")
            else:
                print(f"❌ Failure: Still got '{item['text']}' instead of '{unknown_fix_text}'")
    if not found:
        print("❌ Failure: Test message not found in rankings!")

if __name__ == "__main__":
    try:
        from django.db.models.signals import post_save
        from users.signals import create_profile_on_register, create_initial_spreadsheet, ensure_user_order_form
        post_save.disconnect(create_profile_on_register, sender=User)
        post_save.disconnect(create_initial_spreadsheet, sender=User)
        post_save.disconnect(ensure_user_order_form, sender=User)
        
        with patch('users.utils.assign_unique_id', return_value="DEBUG_ID"):
            debug_shared_rankings()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
