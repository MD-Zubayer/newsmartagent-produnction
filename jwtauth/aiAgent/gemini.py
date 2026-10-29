import logging
from time import monotonic
import json
from django.conf import settings

logger = logging.getLogger('aiAgent')
from jwtauth.provider_metrics import provider_call, record_provider_usage

try:
    from google import genai
    from google.genai import types
    GENAI_CLIENT = genai.Client(api_key=settings.GEMINI_API_KEY)
except Exception:
    GENAI_CLIENT = None

client = GENAI_CLIENT


def generate_gemini_reply(prompt, history, current_message, agent_config, _skip_provider=False):
    """Gemini base helper with an approved OpenAI provider override."""
    if not _skip_provider:
        from ai_extensions.provider_hooks import run_provider_override
        result, version = run_provider_override(
            key="main-answer-provider",
            payload={"system_prompt": prompt, "history": history, "message": current_message},
            agent=agent_config, user=getattr(agent_config, "user", None),
            context={"current_message": current_message}, base_fallback=None,
        )
        if version:
            return result
    if not GENAI_CLIENT:
        return {"reply": "Gemini client not configured.", "total_tokens": 0, "status": "error"}

    model_name = 'gemini-3.1-flash-lite'
    if agent_config and getattr(agent_config, 'ai_model', None):
        configured_model = agent_config.ai_model
        if 'gemini' in configured_model.lower():
            model_name = configured_model

    formatted_history = []
    for m in history:
        role = "model" if m.get("role") == "assistant" else "user"
        formatted_history.append({"role": role, "parts": [{"text": m.get("content", "")} ]})

    formatted_history.append({"role": "user", "parts": [{"text": current_message}]})

    try:
        provider_started = monotonic()
        prompt_lower = (prompt or "").lower()
        force_json = (
            'strict_json_only' in prompt_lower
            or 'response_classification_dsl' in prompt_lower
            or '<output_schema>' in prompt_lower
            or 'return only a valid json object' in prompt_lower
        )
        gen_config_kwargs = {"system_instruction": prompt}
        if force_json:
            gen_config_kwargs["response_mime_type"] = "application/json"

        with provider_call("gemini", "generate_reply"):
            response = GENAI_CLIENT.models.generate_content(
                model=model_name,
                contents=formatted_history,
                config=types.GenerateContentConfig(**gen_config_kwargs)
            )
        reply = response.text.strip() if response.text else ""
        total_tokens = response.usage_metadata.total_token_count or 0
        record_provider_usage("gemini", "generate_reply", model_name, total_tokens, 0, "success", (monotonic() - provider_started) * 1000)
        return {"reply": reply or "", "total_tokens": total_tokens, "status": "success"}
    except Exception as e:
        logger.error(f"Gemini generate error: {e}")
        return {"reply": "Error calling Gemini", "total_tokens": 0, "status": "error", "error": str(e)}


def generate_quick_summary(raw_text):
    from ai_extensions.provider_hooks import run_provider_override
    result, version = run_provider_override(
        key="summary-provider", payload={"prompt": f"Summarize: {raw_text}", "message": raw_text},
        context={"raw_text": raw_text},
        base_fallback=None,
    )
    if version:
        return result.get("reply", "") if isinstance(result, dict) else result
    try:
        if not GENAI_CLIENT:
            return None
        model_name = 'models/gemini-3.1-flash-lite'
        prompt = f"Summarize: {raw_text}"
        try:
            from ai_extensions.resolver import apply_text_override
            prompt, _ = apply_text_override("summary-prompt", prompt, context={"raw_text": raw_text})
        except Exception:
            pass
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
    from ai_extensions.provider_hooks import run_provider_override
    result, version = run_provider_override(
        key="dashboard-assistant-provider",
        payload={"system_prompt": f"You are a dashboard assistant. Context: {page_context}", "history": chat_history, "message": user_query},
        context={"page_context": page_context}, base_fallback=None,
    )
    if version:
        return result
    # Keep original behavior but safe-guarded
    try:
        if not GENAI_CLIENT:
            return {"reply": "AI client not configured", "status": "error"}

        model_name = 'models/gemini-3.1-flash-lite'
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
        if agent_config and agent_config.selected_model:
            provider = agent_config.selected_model.provider or 'gemini'
        elif agent_config and agent_config.ai_model:
            provider = 'openai' if 'gpt' in agent_config.ai_model.lower() else 'gemini'
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

            model_name = 'gemini-3.1-flash-lite'
            if agent_config and getattr(agent_config, 'ai_model', None):
                configured_model = agent_config.ai_model
                if 'gemini' in configured_model.lower():
                    model_name = configured_model
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


def transcribe_audio_with_gemini(audio_bytes: bytes, mime_type: str, agent_config=None) -> str:
    from ai_extensions.provider_hooks import run_provider_override
    result, version = run_provider_override(
        key="audio-transcription-provider",
        payload={"audio_bytes": audio_bytes, "mime_type": mime_type}, agent=agent_config,
        user=getattr(agent_config, "user", None), context={"mime_type": mime_type}, base_fallback=None,
    )
    if version:
        return result.get("reply", "") if isinstance(result, dict) else str(result or "")
    """
    Transcribes audio bytes into text using Gemini API.
    Returns the transcribed text or empty string on failure.
    """
    if not GENAI_CLIENT:
        logger.error("Gemini client not configured for transcription.")
        return ""
    
    model_name = 'gemini-3.1-flash-lite'
    if agent_config and getattr(agent_config, 'ai_model', None):
        configured_model = agent_config.ai_model
        if configured_model and 'gemini' in configured_model.lower():
            model_name = configured_model

    try:
        logger.info(f"🎙️ Transcribing audio with Gemini model {model_name}. Mime type: {mime_type}")
        
        prompt = (
            "You are a highly accurate audio transcriber. Listen to the audio and transcribe "
            "exactly what is said. Respond ONLY with the transcribed text in the language "
            "spoken (which is likely Bengali or English). Do not translate, do not add any "
            "explanations, notes, metadata or formatting. If there is no speech or it is quiet, "
            "return an empty string."
        )
        
        audio_part = types.Part.from_bytes(
            data=audio_bytes,
            mime_type=mime_type
        )
        try:
            from ai_extensions.resolver import apply_text_override
            prompt, _ = apply_text_override("audio-transcription-prompt", prompt, context={"mime_type": mime_type})
        except Exception:
            pass
        
        response = GENAI_CLIENT.models.generate_content(
            model=model_name,
            contents=[audio_part, prompt],
        )
        
        transcription = response.text.strip() if response.text else ""
        logger.info(f"✅ Audio transcription completed: '{transcription[:100]}'")
        return transcription
    except Exception as e:
        logger.error(f"❌ Audio transcription failed: {e}", exc_info=True)
        return ""

