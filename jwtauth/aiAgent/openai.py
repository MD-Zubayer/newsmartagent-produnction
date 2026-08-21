import logging
from openai import OpenAI
from django.conf import settings
from aiAgent.utils import count_openai_tokens

logger = logging.getLogger('aiAgent')

# open ai client
client = OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_openai_reply(system_promt, messages, current_message, agent_config, memory_context=""):
    model_name = agent_config.ai_model
    full_text = system_promt + memory_context + str(messages) + current_message
    input_tokens = count_openai_tokens(full_text, agent_config.ai_model)
    
    try:
        formatted_messages = [
            {'role': 'system', 'content': system_promt}
        ]
        
        # Add history
        for m in messages:
            formatted_messages.append({
                'role': m['role'],
                'content': m['content']
            })
            
        # Add current message
        formatted_messages.append({'role': 'user', 'content': current_message})

        # --- পে-লোড তৈরি ---
        payload = {
            "model": agent_config.ai_model,
            "messages": formatted_messages,
        }

        system_lower = system_promt.lower() if isinstance(system_promt, str) else ''
        force_json_output = (
            'return only a valid json object' in system_lower
            or 'your entire output must start with' in system_lower
            or 'your entire output must start with "{" and end with "}"' in system_lower
            or 'ensure json syntax is perfect' in system_lower
            or 'do not include any conversational text' in system_lower
            or 'return only a valid json object starting with' in system_lower
        )

        if force_json_output:
            model_lower = agent_config.ai_model.lower()
            supports_structured = ("gpt-4o" in model_lower) or ("gpt-4-o" in model_lower) or ("o1-" in model_lower) or ("o3-" in model_lower)
            if supports_structured:
                payload["response_format"] = {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "classification_response",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "reply": {"type": "string"},
                                "cache_type": {"type": "string"},
                                "human_handoff": {"type": "boolean"},
                                "image_intent": {"type": "boolean"},
                                "image_ids": {
                                    "type": "array",
                                    "items": {"type": "integer"}
                                },
                                "image_style": {"type": "string"},
                                "order_intent": {
                                    "type": ["string", "null"]
                                },
                                "order_data": {
                                    "type": "object",
                                    "properties": {
                                        "customer_name": {"type": ["string", "null"]},
                                        "phone_number": {"type": ["string", "null"]},
                                        "address": {"type": ["string", "null"]},
                                        "district": {"type": ["string", "null"]},
                                        "upazila": {"type": ["string", "null"]},
                                        "product_name": {"type": ["string", "null"]},
                                        "quantity": {"type": ["integer", "null"]},
                                        "price": {"type": ["number", "null"]},
                                        "extra_info": {"type": ["string", "null"]},
                                        "items": {
                                            "type": ["array", "null"],
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "name": {"type": "string"},
                                                    "quantity": {"type": "integer"}
                                                },
                                                "required": ["name", "quantity"],
                                                "additionalProperties": False
                                            }
                                        }
                                    },
                                    "required": [
                                        "customer_name", "phone_number", "address", 
                                        "district", "upazila", "product_name", 
                                        "quantity", "price", "extra_info", "items"
                                    ],
                                    "additionalProperties": False
                                }
                            },
                            "required": ["reply", "cache_type", "human_handoff", "image_intent", "image_ids", "image_style", "order_intent", "order_data"],
                            "additionalProperties": False
                        }
                    }
                }
                logger.info("OpenAI JSON Schema enforcement enabled: response_format=json_schema")
            else:
                payload["response_format"] = {"type": "json_object"}
                logger.info("OpenAI JSON enforcement enabled: response_format=json_object")

        model_lower = agent_config.ai_model.lower()
        new_models = ["gpt-5", "o1", "o3", "gpt-4.1"]
        is_new_model = any(m_name in model_lower for m_name in new_models)
        
        # নতুন মডেল এবং 'mini', 'nano' মডেলের জন্য টেমাপারেচার ১ রাখতে হবে
        force_temp_one = any(x in model_lower for x in ["mini", "nano", "o1", "o3"])
        # ১. Temperature সেট করা
        ai_settings = agent_config.get_settings
        if force_temp_one:
            payload["temperature"] = 1.0
        else:
            payload["temperature"] = ai_settings.temperature if ai_settings.temperature is not None else 0.7

        # ২. টোকেন লিমিট সেট করা
        max_t = ai_settings.max_tokens if ai_settings.max_tokens else 1024
        if is_new_model:
            payload["max_completion_tokens"] = max_t
        else:
            payload["max_tokens"] = max_t

        # API কল
        logger.info(f"OpenAI History: {formatted_messages}")
        response = client.chat.completions.create(timeout=30.0, **payload)
        
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