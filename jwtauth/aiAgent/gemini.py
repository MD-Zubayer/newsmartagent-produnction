import logging
import json
from django.conf import settings

logger = logging.getLogger('aiAgent')

try:
    from google import genai
    from google.genai import types
    GENAI_CLIENT = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    GENAI_CLIENT = None

client = GENAI_CLIENT


def generate_gemini_reply(prompt, history, current_message, agent_config):
    """Simple Gemini reply helper (fallback)
    """
    if not GENAI_CLIENT:
        return {"reply": "Gemini client not configured.", "total_tokens": 0, "status": "error"}

    model_name = agent_config.ai_model if agent_config and getattr(agent_config, 'ai_model', None) else 'gemini-2.5-flash'

    formatted_history = []
    for m in history:
        role = "model" if m.get("role") == "assistant" else "user"
        formatted_history.append({"role": role, "parts": [{"text": m.get("content", "")} ]})

    formatted_history.append({"role": "user", "parts": [{"text": current_message}]})

    try:
        response = GENAI_CLIENT.models.generate_content(
            model=model_name,
            contents=formatted_history,
            config=types.GenerateContentConfig(system_instruction=prompt)
        )
        reply = response.text.strip() if response.text else ""
        return {"reply": reply or "", "total_tokens": response.usage_metadata.total_token_count or 0, "status": "success"}
    except Exception as e:
        logger.error(f"Gemini generate error: {e}")
        return {"reply": "Error calling Gemini", "total_tokens": 0, "status": "error", "error": str(e)}


def generate_quick_summary(raw_text):
    try:
        if not GENAI_CLIENT:
            return None
        model_name = 'models/gemini-2.5-flash'
        prompt = f"Summarize: {raw_text}"
        response = GENAI_CLIENT.models.generate_content(
            model=model_name,
            contents=[prompt],
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=600)
        )
        return response.text.strip() if response.text else None
    except Exception as e:
        logger.error(f"Summary generation failed: {e}")
        return None


def generate_dashboard_help(user_query, page_context, chat_history=[]):
    # Keep original behavior but safe-guarded
    try:
        if not GENAI_CLIENT:
            return {"reply": "AI client not configured", "status": "error"}

        model_name = 'models/gemini-2.5-flash'
        system_prompt = f"You are a dashboard assistant. Context: {page_context}"
        formatted_history = []
        for m in chat_history:
            role = "model" if m.get("role") == "assistant" else "user"
            formatted_history.append({"role": role, "parts": [{"text": m.get("content", "")} ]})
        formatted_history.append({"role": "user", "parts": [{"text": user_query}]})

        response = GENAI_CLIENT.models.generate_content(
            model=model_name,
            contents=formatted_history,
            config=types.GenerateContentConfig(system_instruction=system_prompt, temperature=0.3, max_output_tokens=200)
        )
        reply = response.text.strip() if response.text else ""
        return {"reply": reply or "", "total_tokens": response.usage_metadata.total_token_count or 0, "status": "success"}
    except Exception as e:
        logger.error(f"Dashboard help error: {e}")
        return {"reply": "Error", "status": "error"}


def generate_gemini_reply_with_tools(
    prompt, history, current_message, agent_config,
    user_id, sheet_id, platform, enable_image_tool=True
):
    """Provider-agnostic wrapper that exposes image-delivery tool to multiple LLMs.

    Supports: Gemini (if configured), OpenAI, Grok (best-effort via OpenAI-compatible SDK).
    """
    from aiAgent.image_delivery_tools import (
        get_image_delivery_tool_definition,
        execute_image_delivery_tool,
        format_images_for_ai_response
    )

    # Build simple formatted history for providers
    provider = 'gemini'
    try:
        provider = (agent_config.selected_model.provider or 'gemini') if agent_config and getattr(agent_config, 'selected_model', None) else 'gemini'
    except Exception:
        provider = 'gemini'

    # Prepare history/messages
    formatted_history = []
    for m in history:
        formatted_history.append(m)

    # Build tool schema per provider
    from aiAgent.llm_tools import get_tools_for_provider
    tool_def = get_image_delivery_tool_definition()
    tools_list = get_tools_for_provider(provider, tool_def) if enable_image_tool else []

    # Dispatch to provider
    try:
        if 'openai' in provider.lower() or 'grok' in provider.lower():
            # Use OpenAI-compatible functions interface
            import openai
            messages = [{"role": "system", "content": prompt}]
            for m in history:
                role = "assistant" if m.get("role") == "assistant" else "user"
                messages.append({"role": role, "content": m.get("content", "")})
            messages.append({"role": "user", "content": current_message})

            kwargs = {
                'model': agent_config.ai_model if agent_config and getattr(agent_config, 'ai_model', None) else 'gpt-4o-mini',
                'messages': messages,
                'temperature': getattr(agent_config.get_settings, 'temperature', 0.7) if agent_config else 0.7,
                'max_tokens': 512,
            }
            if tools_list:
                kwargs['functions'] = tools_list

            resp = openai.ChatCompletion.create(**kwargs)
            # Parse OpenAI-style response
            choice = resp.choices[0]
            msg = choice.message if hasattr(choice, 'message') else choice['message']
            reply_text = ''
            tool_calls = []
            if isinstance(msg, dict) and msg.get('function_call'):
                fc = msg['function_call']
                name = fc.get('name')
                raw_args = fc.get('arguments')
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except Exception:
                    args = {}
                if name == 'get_product_images_with_presigned_urls':
                    result = execute_image_delivery_tool(user_id, sheet_id, args, agent_config)
                    tool_calls.append({'name': name, 'result': result})
                    reply_text += format_images_for_ai_response(result)
            # Append assistant text if any
            assistant_text = msg.get('content') if isinstance(msg, dict) else getattr(msg, 'content', '')
            if assistant_text:
                reply_text = (reply_text + "\n\n" + assistant_text).strip()

            usage = getattr(resp, 'usage', {})
            input_tokens = usage.get('prompt_tokens', 0) if isinstance(usage, dict) else getattr(usage, 'prompt_tokens', 0)
            output_tokens = usage.get('completion_tokens', 0) if isinstance(usage, dict) else getattr(usage, 'completion_tokens', 0)
            total_tokens = input_tokens + output_tokens

            return {
                'reply': reply_text or "",
                'input_tokens': input_tokens,
                'output_tokens': output_tokens,
                'total_tokens': total_tokens,
                'tool_calls': tool_calls,
                'status': 'success'
            }

        else:
            # Default: Gemini
            if not GENAI_CLIENT:
                return {'reply': 'Gemini not configured', 'status': 'error'}

            model_name = agent_config.ai_model if agent_config and getattr(agent_config, 'ai_model', None) else 'gemini-2.5-flash'
            contents = []
            for m in history:
                role = 'model' if m.get('role') == 'assistant' else 'user'
                contents.append({'role': role, 'parts': [{'text': m.get('content', '')}]})
            contents.append({'role': 'user', 'parts': [{'text': current_message}]})

            config_params = {
                'system_instruction': prompt,
                'temperature': getattr(agent_config.get_settings, 'temperature', 0.7) if agent_config else 0.7,
                'max_output_tokens': 512,
                'candidate_count': 1
            }
            if tools_list:
                config_params['tools'] = tools_list

            response = GENAI_CLIENT.models.generate_content(model=model_name, contents=contents, config=types.GenerateContentConfig(**config_params))
            reply_text = response.text.strip() if response.text else ''
            return {'reply': reply_text, 'total_tokens': response.usage_metadata.total_token_count or 0, 'status': 'success'}

    except Exception as e:
        logger.error(f"LLM with tools error: {e}")
        return {'reply': 'Error processing request', 'status': 'error', 'error': str(e)}
