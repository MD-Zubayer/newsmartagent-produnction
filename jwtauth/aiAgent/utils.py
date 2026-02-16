# aiAgent/utils.py
import tiktoken
from aiAgent.models import UserMemory


def count_openai_tokens(text, model="gpt-4o-mini"):

    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        encoding = tiktoken.get_encoding('cl100k_base')
        return len(encoding.encode(text))

def count_gemini_tokens(model_instance, text_or_messages):

    try:
        if isinstance(text_or_messages, list):
            formatted_messages = []
            for m in text_or_messages:
                formatted_messages.append({
                    'role': 'model' if m.get('role') == 'assistant' else 'user',
                    'parts': [{'text':m.get('content', '')}]
                })



        return model_instance.count_tokens(formatted_messages).total_tokens

    except Exception as e:
        print(f'Gemini token count error: {e}')
        return len(text_or_messages) //2  #1/4 of the word as backup (estimate)


# memory helper
def get_memory_context(ai_agent, sender_id):
    try:
        memory = UserMemory.objects.get(ai_agent=ai_agent, sender_id=sender_id)
        info = memory.data

        clean_info = {k: v for k, v in info.items() if v and str(v).lower() != 'unknown'}

        if not clean_info:
            return ""
        return "Mem: " + ", ".join(clean_info)

    except UserMemory.DoesNotExist:
        return ""