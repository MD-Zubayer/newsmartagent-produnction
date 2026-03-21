
import os
import django
import json
import redis
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
    r_db6 = get_redis_client(db=6)
    
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
    
    # Clear Redis data
    r_db4.delete(f"agent:debug_a:ranking")
    r_db4.delete(f"agent:{b_redis_id}:ranking")
    r_db2.delete(f"agent:debug_a:reply:shared_hash")
    r_db2.delete(f"agent:{b_redis_id}:reply:shared_hash")
    
    # Case: Shared message from B (Web Widget)
    msg_text = "Shared Message from Web Widget B"
    msg_hash = "shared_hash"
    
    # Rankings in B (5 hits)
    r_db4.zincrby(f"agent:{b_redis_id}:ranking", 5, msg_hash)
    
    # Cache in B (DB 2)
    cache_data = {
        "original_text": msg_text,
        "reply": "Reply from B",
        "input_tokens": 100,
        "output_tokens": 50,
        "cache_scope": "agent_specific"
    }
    r_db2.set(f"agent:{b_redis_id}:reply:{msg_hash}", json.dumps(cache_data))
    
    # 3. Call API for Agent A
    factory = APIRequestFactory()
    view = RankingAPIView.as_view()
    request = factory.get('/api/AgentAI/ranking/debug_a/')
    force_authenticate(request, user=user)
    
    response = view(request, agent_id="debug_a")
    
    print(f"Status Code: {response.status_code}")
    data = response.data.get('data', [])
    
    print("\nDebug results for Agent A (Sharing from B):")
    for item in data:
        print(f"Text: {item['text']}")
        print(f"Hash: {item['msg_hash']}")
        print(f"Frequency: {item['frequency']}")
        print(f"Tokens Saved: {item['token_savings']}")
        print(f"Is Shared: {item['is_shared']}")
        print("-" * 20)

    # Check for failure
    for item in data:
        if item['text'] == "Unknown Message":
             print("\n!!! FAILURE: Found 'Unknown Message'")
        if item['token_savings'] == 0 and item['frequency'] > 1:
             print("\n!!! FAILURE: Token savings is 0 but frequency > 1")

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
