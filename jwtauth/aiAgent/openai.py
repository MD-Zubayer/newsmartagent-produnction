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

        temp = agent_config.temperature if agent_config.temperature is not None else 1.0
        tokens = agent_config.max_tokens if agent_config.max_tokens is not None else 500
        payload = {
            "model": agent_config.ai_model,
            "messages": formatted_messages,
            "temperature": agent_config.temperature,
        }
        new_models = ["gpt-5", "o1", "o3", "gpt-4.1"]
        if any(model_name in agent_config.ai_model.lower() for model_name in new_models):
            payload["max_completion_tokens"] = agent_config.max_tokens
            # নতুন মডেলগুলোতে temperature অনেক সময় ১ ই রাখা হয়
            if "o1" in agent_config.ai_model or "o3" in agent_config.ai_model:
                payload["temperature"] = 1
        else:
            payload["max_tokens"] = agent_config.max_tokens

        # আনপ্যাক করে কল করা
        response = client.chat.completions.create(**payload)
        reply =  response.choices[0].message.content.strip()

        output_tokens = response.usage.completion_tokens
        if not output_tokens:
            output_tokens = count_openai_tokens(reply, agent_config.ai_model)

        
        payload = {
            "model": agent_config.ai_model,
            "messages": formatted_messages,
        }

        new_models = ["gpt-5", "o1", "o3", "gpt-4.1"]
        # nano এবং mini দুইটাই চেক করুন
        is_new_model = any(m_name in agent_config.ai_model.lower() for m_name in new_models)
        
        # মডেলের নামে mini বা nano থাকলে temperature ১ হতে হবে
        force_temp_one = any(x in agent_config.ai_model.lower() for x in ["mini", "nano", "o1", "o3"])

        if is_new_model:
            payload["max_completion_tokens"] = agent_config.max_tokens if agent_config.max_tokens else 500

            
            if force_temp_one:
                payload["temperature"] = 1.0  # এরর থেকে বাঁচতে ফিক্সড ১
            else:
                payload["temperature"] = agent_config.temperature if agent_config.temperature is not None else 0.7
        else:
            payload["max_tokens"] = agent_config.max_tokens if agent_config.max_tokens else 500
            payload["temperature"] = agent_config.temperature if agent_config.temperature is not None else 0.7

        # API কল
        response = client.chat.completions.create(**payload)
        
        # --- সেফলি রিপ্লাই এক্সট্রাক্ট করা ---
        message = response.choices[0].message
        raw_reply = message.content

        # ডিবাগ করার জন্য টার্মিনালে প্রিন্ট করুন
        print(f"\n--- [DEBUG] Raw AI Reply Length: {len(raw_reply) if raw_reply else 0} ---")
        print(f"--- [DEBUG] Content: {raw_reply}")
        # Newer models (e.g. gpt-5-nano) may return None in content; log full message for diagnosis
        if not raw_reply:
            print(f"--- [DEBUG] Full message object: {message}")
        print()

        if raw_reply:
            reply = raw_reply.strip()
            result_status = "success"
        else:
            # Fallback: check for a refusal reason and surface it
            refusal = getattr(message, 'refusal', None)
            if refusal:
                reply = f"[AI Refusal] {refusal}"
            else:
                reply = f"System busy: model '{agent_config.ai_model}' returned an empty response."
            result_status = "empty_response"  # ← success না, কারণ content আসেনি

        output_tokens = response.usage.completion_tokens if response.usage.completion_tokens else count_openai_tokens(reply, agent_config.ai_model)
        total_tokens = input_tokens + output_tokens

        print(f'OpenAI Input: {input_tokens} | Output: {output_tokens} | Total: {total_tokens}')
        
        return {
            "reply": reply,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "model_name": agent_config.ai_model,
            "status": result_status  # ← এখন সঠিকভাবে "success" বা "empty_response"
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