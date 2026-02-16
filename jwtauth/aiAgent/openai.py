from openai import OpenAI
from django.conf import settings
from aiAgent.utils import count_openai_tokens

# open ai client
client = OpenAI(api_key=settings.OPENAI_API_KEY)

def generate_openai_reply(system_promt, messages, agent_config, memory_context=""):

    full_text = system_promt + memory_context + str(messages)
    input_tokens = count_openai_tokens(full_text, agent_config.ai_model)
    try:
        formatted_messages = [{'role': 'system', 'content': system_promt}]

        for m in messages:
            formatted_messages.append({
                'role': m['role'],
                'content': m['content']
            })

        response = client.chat.completions.create(
            model=agent_config.ai_model,
            messages=formatted_messages,
            temperature=agent_config.temperature,
            max_tokens=agent_config.max_tokens
        )

        reply =  response.choices[0].message.content.strip()

        output_tokens = response.usage.completion_tokens
        if not output_tokens:
            output_tokens = count_openai_tokens(reply, agent_config.ai_model)
            

        total_tokens = input_tokens + output_tokens


        print(f'OpenAI Input: {input_tokens} | Output: {output_tokens} | Total: {total_tokens}')
        return {
            "reply": reply,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": agent_config.ai_model,
            "status": "success"
        }


    except Exception as e:
        print(f'OpenAi API Error: {str(e)}')
        return {
            "reply": "OpenAI system is currently unavailable. Please try again later.",
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "status": "error",
            "error_message": str(e)
        }

