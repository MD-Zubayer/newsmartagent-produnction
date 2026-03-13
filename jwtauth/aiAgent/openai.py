from openai import OpenAI
from django.conf import settings
from aiAgent.utils import count_openai_tokens

# open ai client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_openai_reply(system_promt, messages, agent_config, memory_context=""):
    model_name = agent_config.ai_model
    full_text = system_promt + memory_context + str(messages)
    input_tokens = count_openai_tokens(full_text, agent_config.ai_model)
    
    try:
        formatted_messages = [{'role': 'system', 'content': system_promt}]
        for m in messages:
            formatted_messages.append({
                'role': m['role'],
                'content': m['content']
            })

        # --- পে-লোড তৈরি (একবারই করা ভালো) ---
        payload = {
            "model": agent_config.ai_model,
            "messages": formatted_messages,
        }

        model_lower = agent_config.ai_model.lower()
        new_models = ["gpt-5", "o1", "o3", "gpt-4.1"]
        is_new_model = any(m_name in model_lower for m_name in new_models)
        
        # নতুন মডেল এবং 'mini', 'nano' মডেলের জন্য টেম্পারেচার ১ রাখতে হবে
        force_temp_one = any(x in model_lower for x in ["mini", "nano", "o1", "o3"])

        # ১. Temperature সেট করা
        if force_temp_one:
            payload["temperature"] = 1.0
        else:
            payload["temperature"] = agent_config.temperature if agent_config.temperature is not None else 0.7

        # ২. টোকেন লিমিট সেট করা (নতুন মডেলে max_completion_tokens ব্যবহার হয়)
        max_t = agent_config.max_tokens if agent_config.max_tokens else 500
        if is_new_model:
            payload["max_completion_tokens"] = max_t
        else:
            payload["max_tokens"] = max_t

        # API কল
        response = client.chat.completions.create(**payload)
        
        # --- রিপ্লাই এক্সট্রাক্ট করা ---
        message = response.choices[0].message
        raw_reply = message.content

        print(f"\n--- [DEBUG] Raw AI Reply Length: {len(raw_reply) if raw_reply else 0} ---")
        
        if raw_reply:
            reply = raw_reply.strip()
            result_status = "success"
        else:
            refusal = getattr(message, 'refusal', None)
            if refusal:
                reply = f"[AI Refusal] {refusal}"
            else:
                reply = f"System busy: model '{agent_config.ai_model}' returned an empty response."
            result_status = "empty_response"

        # টোকেন হিসাব
        output_tokens = response.usage.completion_tokens if response.usage.completion_tokens else count_openai_tokens(reply, agent_config.ai_model)
        total_tokens = input_tokens + output_tokens

        print(f'OpenAI Input: {input_tokens} | Output: {output_tokens} | Total: {total_tokens}')
        
        return {
            "reply": reply or "Sorry, I didn't understand.",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": model_name,
            "status": result_status
        }

    except Exception as e:
        print(f'OpenAi API Error: {str(e)}')
        return {
            "reply": "The system is experiencing some problems, please try again later.",
            "input_tokens": 0,
            "output_tokens": 0,
            "total_tokens": 0,
            "model_name": model_name,
            "status": "error",
            "error_message": str(e)
        }