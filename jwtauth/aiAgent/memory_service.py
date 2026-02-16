import json
from aiAgent.openai import client


def extract_and_update_memory(ai_agent, sender_id, chat_history):

    """
    Extracts necessary information from user messages and saves it in memory

    """
    if ai_agent.ai_agent_type == 'business':
        extract_fields = "name, location, address, number,budget, requirement, product_interest "
    elif ai_agent.ai_agent_type == 'creator':
        extract_fields = "name, interests, video_request, location"
    else:
        extract_fields = "name, key_topics"
    extract_prompt = f"""
    Analyze this chat history and extract user information into JSON format.
    Fields to extract: {extract_fields}.
    If a field is unknown, keep it null.
    Chat History:
    {chat_history}
    Return ONLY JSON.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{'role': 'system', 'content': "You are a professional data extractor."},
            {'role': 'user', 'content': extract_prompt}
            ],
            temperature=0,
            response_format={'type': 'json_object'}
        )

        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        extraction_total_tokens = input_tokens + output_tokens
        print(f"Extraction Tokens -> Input: {input_tokens}, Output: {output_tokens}, Total: {extraction_total_tokens}")

        try:
            from chat.models import Message, Conversation
            # Finding the relevant conversation
            conv = Conversation.objects.filter(agentAi=ai_agent,contact_id=sender_id).first()
            if conv:
                Message.objects.create(
                    conversation=conv,
                    role='assistant',
                    content=f'[System: Memory Updated for {sender_id}]',
                    tokens_used =extraction_total_tokens
                )
                print(f"Token saved to Message model: {extraction_total_tokens}")
        except Exception as e:
            print(f"Failed to save extraction tokens to Message model: {e}")



        new_data = json.loads(response.choices[0].message.content)

        # database update & save
        from aiAgent.models import UserMemory
        memory, _ = UserMemory.objects.get_or_create(ai_agent=ai_agent, sender_id=sender_id)

        # # Merge new data with previous data (if not null)
        current_info = memory.data or {}
        current_info.update({k: v for k, v in new_data.items() if v})
        memory.data = current_info
        memory.save()

        print(f"Memory Updated for {sender_id}: {memory}")
    except Exception as e:
        print(f'Memory Extraction Error: {e}')