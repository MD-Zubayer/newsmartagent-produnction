from openai import OpenAI
from django.conf import settings

def generate_grok_reply(system_prompt, messages, agent_config):
    """
    xAI Grok handler using OpenAI-compatible API.
    """
    api_key = getattr(settings, 'GROK_API_KEY', None)
    if not api_key:
        return {
            "reply": "Grok API Key not configured.",
            "status": "error",
            "error_message": "GROK_API_KEY missing in settings."
        }

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.x.ai/v1",
    )

    model_name = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model

    try:
        formatted_messages = [{'role': 'system', 'content': system_prompt}]
        for m in messages:
            formatted_messages.append({
                'role': m['role'],
                'content': m['content']
            })

        response = client.chat.completions.create(
            model=model_name,
            messages=formatted_messages,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens
        )

        reply = response.choices[0].message.content
        if reply:
            reply = reply.strip()
            status = "success"
        else:
            reply = "System busy: Grok returned an empty response."
            status = "empty_response"
        
        # Grok tokens (approximation if not provided by usage)
        input_tokens = getattr(response.usage, 'prompt_tokens', 0)
        output_tokens = getattr(response.usage, 'completion_tokens', 0)
        total_tokens = input_tokens + output_tokens

        return {
            "reply": reply,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": model_name,
            "status": status
        }

    except Exception as e:
        return {
            "reply": "Grok system is currently unavailable.",
            "status": "error",
            "error_message": str(e)
        }
