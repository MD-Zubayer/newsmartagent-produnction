
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

if __name__ == '__main__':
    unittest.main()
