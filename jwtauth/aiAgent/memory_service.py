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
    Analyze the chat history and extract significant user details. 

    CRITICAL Rules:
    - OMIT any field that would be null, empty string, or empty list. 
    - Construct a compact JSON object containing ONLY the discovered data.
    - Fields to look for (if available): name, phone_number, email, location, job, preferences (likes/dislikes), product_interest, order_details, needs_or_cahida, contextual_data (goals/urgency), sentiment, and key_requirements.
    - CRM RULES (MANDATORY): Always evaluate and output a "lead_stage" field. It must be exactly one of: "new", "cold", "warm", "hot", "converted", or "lost".
    - Include a "memory_summary" that briefly gists the user's core intent or relationship status (e.g., "Wants to buy red shoes, quoted 500 BDT").
    - Return ONLY the JSON object. No preamble, no markdown formatting.

    Chat History:
    {chat_history}
    """

    try:
        reply_json = {}
        total_tokens = 0

        # 2. Dispatch to the selected provider
        if provider == 'openai' or provider == 'openrouter' or provider == 'grok':
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
                    {'role': 'system', 'content': "You are an advanced Relationship Intelligence Engine. Your goal is to build deep, useful memories of users."},
                    {'role': 'user', 'content': extract_prompt}
                ],
                temperature=0,
                response_format={'type': 'json_object'}
            )
            reply_json = json.loads(response.choices[0].message.content)
            total_tokens = response.usage.total_tokens

        elif provider == 'gemini':
            response = gemini_client.models.generate_content(
                model=model_id,
                contents=[extract_prompt],
                config=gemini_types.GenerateContentConfig(
                    system_instruction="You are an advanced Relationship Intelligence Engine. Your goal is to build deep, useful memories of users. Return ONLY valid JSON.",
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
            if provider == 'gemini':
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
