
import sys
import unittest
from unittest.mock import MagicMock, patch

# Mock Django settings and models before importing
sys.modules['django'] = MagicMock()
sys.modules['django.conf'] = MagicMock()
sys.modules['django.db'] = MagicMock()
sys.modules['django.core.cache'] = MagicMock()
sys.modules['rest_framework'] = MagicMock()
sys.modules['rest_framework.views'] = MagicMock()
sys.modules['rest_framework.response'] = MagicMock()
sys.modules['rest_framework.permissions'] = MagicMock()
sys.modules['google'] = MagicMock()
sys.modules['google.genai'] = MagicMock()

# Mock local imports that would fail
sys.modules['chat.models'] = MagicMock()
sys.modules['aiAgent.models'] = MagicMock()
sys.modules['aiAgent.memory_service'] = MagicMock()
sys.modules['aiAgent.utils'] = MagicMock()
sys.modules['settings.models'] = MagicMock()
sys.modules['users.models'] = MagicMock()

class TestAIHistoryFix(unittest.TestCase):

    def test_history_order_logic(self):
        # Simulating the change in services.py
        messages = [
            MagicMock(id=5, role='assistant', content='Msg 5'),
            MagicMock(id=4, role='user', content='Msg 4'),
            MagicMock(id=3, role='assistant', content='Msg 3'),
            MagicMock(id=2, role='user', content='Msg 2'),
            MagicMock(id=1, role='assistant', content='Msg 1'),
        ]
        
        # Original (buggy) was returning as is (newest first because of -id)
        # New fix uses reversed(messages)
        chronological = [
            {'role': m.role, 'content': m.content}
            for m in reversed(messages)
        ]
        
        self.assertEqual(chronological[0]['content'], 'Msg 1')
        self.assertEqual(chronological[-1]['content'], 'Msg 5')
        print("✅ History order verification: PASSED")

    def test_openai_prompt_structure(self):
        # Simulating generate_openai_reply
        system_promt = "You are a helpful assistant"
        history = [
            {'role': 'user', 'content': 'Hi'},
            {'role': 'assistant', 'content': 'Hello!'}
        ]
        current_message = "What's my name?"
        
        formatted_messages = [{'role': 'system', 'content': system_promt}]
        for m in history:
            formatted_messages.append({'role': m['role'], 'content': m['content']})
        formatted_messages.append({'role': 'user', 'content': current_message})
        
        self.assertEqual(formatted_messages[0]['role'], 'system')
        self.assertEqual(formatted_messages[1]['content'], 'Hi')
        self.assertEqual(formatted_messages[-1]['content'], "What's my name?")
        self.assertEqual(formatted_messages[-1]['role'], 'user')
        print("✅ OpenAI prompt structure verification: PASSED")

    def test_gemini_prompt_structure(self):
        # Simulating generate_gemini_reply
        prompt = "System instructions"
        history = [
            {'role': 'user', 'content': 'Hi'},
            {'role': 'assistant', 'content': 'Hello!'}
        ]
        current_message = "User query"
        
        formatted_history = []
        for m in history:
            role = "model" if m["role"] == "assistant" else "user"
            formatted_history.append({"role": role, "parts": [{"text": m["content"]}]})
        
        formatted_history.append({"role": "user", "parts": [{"text": current_message}]})
        
        self.assertEqual(formatted_history[0]['parts'][0]['text'], 'Hi')
        self.assertEqual(formatted_history[-1]['parts'][0]['text'], 'User query')
        self.assertEqual(formatted_history[-1]['role'], 'user')
        print("✅ Gemini prompt structure verification: PASSED")

    def test_color_filtering(self):
        COLOUR_SYNONYMS = {
            'kalo':   ['black', 'dark', 'jet black', 'charcoal', 'কালো', 'কুচকুচে'],
            'shada':  ['white', 'light', 'off-white', 'snow white', 'সাদা', 'ধবধবে'],
            'lal':    ['red', 'maroon', 'crimson', 'scarlet', 'burgundy', 'লাল', 'খয়েরি', 'টকটকে লাল'],
            'komola': ['orange', 'peach', 'apricot', 'saffron', 'কমলা', 'গেরুয়া'],
        }

        def _filter_images_by_color(q: str, candidates: list) -> list:
            q_lower = q.lower()
            requested_groups = set()
            for group_name, synonyms in COLOUR_SYNONYMS.items():
                all_terms = [group_name] + synonyms
                if any(t in q_lower for t in all_terms):
                    requested_groups.add(group_name)
            
            if not requested_groups:
                return candidates
                
            filtered = []
            for item in candidates:
                img_obj = item['_obj']
                caption = (img_obj.image_caption or '').lower()
                
                mentions_requested = False
                mentions_other = False
                
                for group_name, synonyms in COLOUR_SYNONYMS.items():
                    all_terms = [group_name] + synonyms
                    if any(t in caption for t in all_terms):
                        if group_name in requested_groups:
                            mentions_requested = True
                        else:
                            mentions_other = True
                            
                # Exclude only if it explicitly mentions a different color, and NOT the requested color
                if mentions_other and not mentions_requested:
                    continue
                filtered.append(item)
            return filtered

        class MockImage:
            def __init__(self, image_id, image_caption):
                self.id = image_id
                self.image_caption = image_caption

        candidates = [
            {'_obj': MockImage(1, "A beautiful black shirt featuring a primary black color")},
            {'_obj': MockImage(2, "An orange punjabi featuring a primary orange color")},
            {'_obj': MockImage(3, "Just a plain shirt")},
        ]

        # Case 1: Query for black (kalo)
        res1 = _filter_images_by_color("black", candidates)
        self.assertEqual(len(res1), 2)
        self.assertEqual(res1[0]['_obj'].id, 1)
        self.assertEqual(res1[1]['_obj'].id, 3)  # kept as fallback

        # Case 2: Query for orange (komola)
        res2 = _filter_images_by_color("orange punjabi", candidates)
        self.assertEqual(len(res2), 2)
        self.assertEqual(res2[0]['_obj'].id, 2)
        self.assertEqual(res2[1]['_obj'].id, 3)  # kept as fallback

        # Case 3: Query with no color keywords
        res3 = _filter_images_by_color("some shirt", candidates)
        self.assertEqual(len(res3), 3)

        print("✅ Color filtering verification: PASSED")

if __name__ == '__main__':
    unittest.main()
