import json
from aiAgent.openai import client


def extract_and_update_memory(ai_agent, sender_id, chat_history):
    """
    Dynamically extracts ANY important information from chat history and saves it.
    Supports multiple providers (OpenAI, Gemini, Grok) based on admin preference.
    """
    from aiAgent.openai import client as openai_client
    from aiAgent.gemini import client as gemini_client
    from google.genai import types as gemini_types

    # 1. Determine which model to use (Admin Setting)
    if ai_agent.memory_extraction_model:
        model_obj = ai_agent.memory_extraction_model
        provider = model_obj.provider
        model_id = model_obj.model_id
    else:
        # System Default
        provider = 'openai'
        model_id = 'gpt-4o-mini'

    # Optimized prompt for concise extraction and token savings
    extract_prompt = f"""
    You are the CRM brain. Read the chat history and return ONLY a JSON object of extracted facts.

    STRICT RULES:
    - Output must be valid JSON object, no prose, no markdown.
    - Drop any field that is null/empty.
    - Fields to include when present: name, phone_number, email, location, job, preferences (likes/dislikes), product_interest, order_details, needs_or_cahida, contextual_data (goals/urgency), sentiment, key_requirements.
    - memory_summary: 1 short sentence of the user's intent/status (e.g., "Wants 2 red shoes, budget 500 BDT").

    LEAD STAGE (MANDATORY):
    - lead_stage must be ONE of: new, cold, warm, hot, converted, lost.
    - Use these hints:
        • new: first contact, no intent yet.
        • cold: old/idle lead or vague interest, no next step agreed.
        • warm: clear interest/request or provided contact info, awaiting quote/demo.
        • hot: strong intent with price/quantity/timeframe, or close to purchase.
        • converted: deal/order/booking/payment confirmed.
        • lost: user declined, went elsewhere, or explicitly stopped.

    Return only the JSON object.

    Chat History:
    {chat_history}
    """

    try:
        try:
            from ai_extensions.resolver import apply_text_override
            extract_prompt, _ = apply_text_override(
                "memory-extraction-prompt", extract_prompt, agent=ai_agent,
                user=getattr(ai_agent, "user", None), context={"sender_id": sender_id},
            )
        except Exception:
            pass
        try:
            from ai_extensions.resolver import apply_text_override
            memory_system_prompt, _ = apply_text_override(
                "memory-extraction-system",
                "You are an advanced Relationship Intelligence Engine. Your goal is to build deep, useful memories of users.",
                agent=ai_agent, user=getattr(ai_agent, "user", None), context={"sender_id": sender_id},
            )
        except Exception:
            memory_system_prompt = "You are an advanced Relationship Intelligence Engine. Your goal is to build deep, useful memories of users."
        reply_json = {}
        total_tokens = 0
        provider_override = None
        try:
            from ai_extensions.provider_hooks import run_provider_override
            provider_override, override_version = run_provider_override(
                key="memory-provider",
                payload={"system_prompt": memory_system_prompt, "prompt": extract_prompt, "message": extract_prompt},
                agent=ai_agent, user=getattr(ai_agent, "user", None),
                context={"sender_id": sender_id}, base_fallback=None,
            )
            if override_version:
                reply_json = provider_override.get("data", {}) if isinstance(provider_override, dict) else {}
                total_tokens = provider_override.get("total_tokens", 0) if isinstance(provider_override, dict) else 0
        except Exception:
            provider_override = None

        # 2. Dispatch to the selected provider
        if provider_override is None and (provider == 'openai' or provider == 'openrouter' or provider == 'grok'):
            # Grok and OpenRouter are OpenAI-compatible in this setup
            if provider == 'grok':
                from openai import OpenAI as GrokClient
                from django.conf import settings
                client = GrokClient(api_key=settings.GROK_API_KEY, base_url="https://api.x.ai/v1")
            else:
                client = openai_client

            response = client.chat.completions.create(
                model=model_id,
                messages=[
                    {'role': 'system', 'content': memory_system_prompt},
                    {'role': 'user', 'content': extract_prompt}
                ],
                temperature=0,
                response_format={'type': 'json_object'}
            )
            reply_json = json.loads(response.choices[0].message.content)
            total_tokens = response.usage.total_tokens

        elif provider_override is None and provider == 'gemini':
            response = gemini_client.models.generate_content(
                model=model_id,
                contents=[extract_prompt],
                config=gemini_types.GenerateContentConfig(
                    system_instruction=f"{memory_system_prompt} Return ONLY valid JSON.",
                    temperature=0,
                    response_mime_type="application/json"
                )
            )
            reply_json = json.loads(response.text)
            total_tokens = response.usage_metadata.total_token_count

        print(f"🧠 Smart Extraction ({provider}): {sender_id} | Tokens: {total_tokens}")

        # Save token usage for system accounting (Dashboard Analytics)
        try:
            from aiAgent.models import TokenUsageLog
            
            # Find the platform from the most recent message for this sender (if any)
            from chat.models import Message, Conversation
            conv = Conversation.objects.filter(agentAi=ai_agent, contact_id=sender_id).first()
            platform = 'background_sync'
            if conv:
                last_msg = Message.objects.filter(conversation=conv).order_by('-sent_at').first()
                if last_msg and hasattr(last_msg, 'platform'):
                     platform = last_msg.platform
                
                # Also log detailed message in conversation
                Message.objects.create(
                    conversation=conv,
                    role='assistant',
                    content=f'[System: Intelligence Synced ({provider}) for {sender_id}]',
                    tokens_used=total_tokens
                )

            # Robust Token Extraction (provider-agnostic)
            if provider_override is not None:
                i_tokens = provider_override.get("input_tokens", 0)
                o_tokens = provider_override.get("output_tokens", 0)
            elif provider == 'gemini':
                i_tokens = response.usage_metadata.prompt_token_count
                o_tokens = response.usage_metadata.candidates_token_count
            else:
                # OpenAI / Grok / OpenRouter
                i_tokens = response.usage.prompt_tokens
                o_tokens = response.usage.completion_tokens

            TokenUsageLog.objects.create(
                user=ai_agent.user,
                ai_agent=ai_agent,
                sender_id=sender_id,
                platform=platform,
                model_name=model_id,
                input_tokens=i_tokens,
                output_tokens=o_tokens,
                total_tokens=total_tokens,
                request_type='memory_extraction',
                success=True,
                response_time=0
            )
            
        except Exception as e:
            import traceback
            print(f"Failed to log extraction tokens: {type(e).__name__}: {e}")
            print(traceback.format_exc())

        # Database update & Smart Merge
        from aiAgent.models import UserMemory
        memory, _ = UserMemory.objects.get_or_create(ai_agent=ai_agent, sender_id=sender_id)

        current_info = memory.data or {}

        # --- Lead Stage Safety Net ---
        allowed_stages = {"new", "cold", "warm", "hot", "converted", "lost"}
        incoming_stage = reply_json.get("lead_stage")

        if incoming_stage:
            incoming_stage = incoming_stage.lower()
            if incoming_stage not in allowed_stages:
                incoming_stage = "warm"
            reply_json["lead_stage"] = incoming_stage
        else:
            # If the model missed it, derive a sensible default
            if current_info.get("lead_stage"):
                reply_json["lead_stage"] = current_info["lead_stage"]
            else:
                # If we already got a memory_summary, treat as warm lead
                reply_json["lead_stage"] = "warm" if reply_json.get("memory_summary") else "new"

        current_info.update({k: v for k, v in reply_json.items() if v is not None})
        
        memory.data = current_info
        memory.save()

        print(f"✅ Memory Deepened for {sender_id}. Keys: {list(current_info.keys())}")
    except Exception as e:
        print(f'❌ Smart Memory Extraction Error ({provider}): {e}')
