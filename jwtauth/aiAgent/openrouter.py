from openai import OpenAI
from django.conf import settings

def generate_openrouter_reply(system_prompt, messages, current_message, agent_config):
    """
    OpenRouter handler using OpenAI-compatible API.
    """
    api_key = getattr(settings, 'OPENROUTER_API_KEY', None)
    if not api_key:
        return {
            "reply": "OpenRouter API Key not configured.",
            "status": "error",
            "error_message": "OPENROUTER_API_KEY missing in settings."
        }

    client = OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )

    model_name = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

    try:
        formatted_messages = [{'role': 'system', 'content': system_prompt}]
        for m in messages:
            formatted_messages.append({
                'role': m['role'],
                'content': m['content']
            })
        
        # Add current message
        formatted_messages.append({'role': 'user', 'content': current_message})

        ai_settings = agent_config.get_settings
        response = client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
            temperature=ai_settings.temperature,
            max_tokens=ai_settings.max_tokens,
            extra_headers={
                "HTTP-Referer": "https://newsmartagent.com",
                "X-Title": "New Smart Agent",
            }
        )

        reply = response.choices[0].message.content.strip()
        
        input_tokens = getattr(response.usage, 'prompt_tokens', 0)
        output_tokens = getattr(response.usage, 'completion_tokens', 0)
        total_tokens = input_tokens + output_tokens

        return {
            "reply": reply,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": model_name,
            "status": "success"
        }

    except Exception as e:
        return {
            "reply": "OpenRouter system is currently unavailable.",
            "status": "error",
            "error_message": str(e)
        }
