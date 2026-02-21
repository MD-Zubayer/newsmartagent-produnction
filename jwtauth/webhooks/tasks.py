from celery import shared_task
import requests
import json
from aiAgent.models import AgentAI
from chat.services import save_message, get_last_message
from aiAgent.gemini import generate_reply
from aiAgent.openai import generate_openai_reply
from aiAgent.models import AgentAI, MissingRequirement
from aiAgent.utils import get_memory_context
from aiAgent.memory_service import extract_and_update_memory
from aiAgent.memory_handler import handle_smart_memory_update
from webhooks.constants import TARGET_KEYWORDS
from aiAgent.data_processor import processor_spreadsheet_data
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import time
from embedding.models import SpreadsheetKnowledge
from pgvector.django import CosineDistance
from embedding.utils import get_gemini_embedding
from settings.models import AgentSettings
from users.models import OrderForm

@shared_task
def process_ai_reply_task(data):

    start_time = time.time()

    sender_id = data.get('sender_id')
    page_id = data.get('page_id')
    request_type = data.get('type')
    text = data.get('comment_text') if request_type == 'facebook_comment' else data.get('message')

    if not all([sender_id, text, page_id]):
        print(f"Aborting: Missing core data in task. sender: {sender_id}, text: {text}")
        return

    
    try:
        agent_config = AgentAI.objects.get(page_id=page_id, is_active=True)
        # <!---------------User profile -------------------!>
        user_profile = agent_config.user.profile
    
    except Exception as e:
        print(f'Error: Agent not found for page_id {page_id} - {e}')
        return

    # order settings 
    order_instruction = ""
    try:
        settings, created = AgentSettings.objects.get_or_create(user=agent_config.user)

        if settings.is_order_enable:
            try:
                order_form = OrderForm.objects.get(user=agent_config.user)
                link = f'https://newsmartagent.com/orders/{order_form.form_id}'
                order_instruction = f"If user wants to buy/order, strictly give this link: {link}."
            except OrderForm.DoesNotExist:
                order_instruction = "If they want to buy, say order form is not ready yet."
        else:
            order_instruction = "Online ordering is currently closed. Ask them to contact support for manual orders."
    except Exception as e:
        print(f"Settings Error: {e}")
        order_instruction = "Handle orders politely."
    

     #<!----------------- 1. RAG logic start (Keyword filtering excluded) --------------!>
    sheet_context = ""
    extra_instruction = ""

    try:


        #<!------------------- Convert user message to vector -----------------------!>
        query_vector = get_gemini_embedding(text)
        print(f"DEBUG: Vector Generated: {True if query_vector else False}")
        if query_vector:
            #<!------------------ Finding the 3 most relevant rows from a vector database ---------------!>
            related_docs = SpreadsheetKnowledge.objects.filter(
                user=agent_config.user
            ).annotate(
                distance=CosineDistance('embedding', query_vector)
            ).order_by('distance')[:3]

       
            if related_docs and related_docs[0].distance < 0.45:
                
                matched_content = [doc.content for doc in related_docs]
                clean_data = "\n".join(matched_content)
                sheet_context = f"\n[DATA]:\n{clean_data}"
                extra_instruction = f"""
Answer strictly using only the content inside [DATA].
Keep the response short and clear.
No markdown, no bold text, no formatting.
Be friendly, natural, and conversational.
If appropriate, end with a short, warm follow-up question that encourages the user to continue.
{order_instruction}
"""
                print(f">>> RAG Match Found! Top Distance: {related_docs[0].distance}")
            else:
                sheet_context = ""
                extra_instruction = f"\nIf not found in [DATA], ask them to wait. {order_instruction}"
                print(f">>> Weak Match (Distance: {related_docs[0].distance if related_docs else 'N/A'}). Skipping context.")
    except Exception as e:
        print(f"RAG Search Error: {e}")
        extra_instruction = " Answer politely. If data missing, ask to wait. {order_instruction}"
    

    page_access_token = agent_config.access_token
    # save user message
    # conditional memory loading
    memory_context = ""
    memory_triggers = ['আমার', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']
    if any(word in text.lower() for word in memory_triggers):
        mem_data =  get_memory_context(agent_config, sender_id)
        if mem_data:
            memory_context = f"\nMem: {mem_data}"
            print(f">>> Memory Loaded for Sender: {sender_id}")


    save_message(agent_config, sender_id, text, 'user')

    # get memory context

    prompt_parts = [agent_config.system_prompt + extra_instruction]
    if sheet_context:
        prompt_parts.append(sheet_context)
    if memory_context:
        prompt_parts.append(memory_context)
    full_prompt = "\n".join(prompt_parts)
    # get history
    history = get_last_message(agent_config, sender_id, limit=3)

    try:

        if user_profile.word_balance <=0:

            print(f">>> User {user_profile.user.email} has 0 tokens. Aborting AI reply.")
            return
        #   <!---------------- AI reply -----------------!>

        model_choice = agent_config.ai_model.lower()

        if 'gpt' in model_choice:
            print("DEBUG FULL PROMPT:", full_prompt)
            ai_response = generate_openai_reply(full_prompt, history, agent_config=agent_config)
        else:
            ai_response = generate_reply(full_prompt, history, agent_config=agent_config)

        # --- DEBUG START ---
        print("🔍 DEBUG: AI Raw Response Type:", type(ai_response))
        print("🔍 DEBUG: AI Raw Response Content:", ai_response)
        # --- DEBUG END ---
        
        reply = "System busy."
        input_tokens = 0
        output_tokens = 0
        total_tokens = 0
        success = False
        error_info = ""
        # <!------------------- 1. Extracting data (Dictionary format handling) -------------------------!>

        if isinstance(ai_response, dict):
            reply = ai_response.get('reply', "System busy.")
            input_tokens = ai_response.get('input_tokens', 0)
            output_tokens = ai_response.get('output_tokens', 0)
            total_tokens = ai_response.get('total_tokens', 0)

            response_status = ai_response.get('status')
            reply = reply.replace('**', '').replace('*', '')
            # --- DEBUG START ---

            print(f"🔍 DEBUG: Status from AI: '{response_status}'")
            print(f"🔍 DEBUG: Reply Length: {len(reply)}")

       
            success = (response_status == 'success') or len(reply) > 5
            print(f"🔍 DEBUG: Final Success Decision: {success}")
            # --- DEBUG END ---

            if not success:
                error_info = ai_response.get('error_message') or f'AI status: {response_status}'

        else:
            # <!----------------------# If for some reason the old tuple format comes back (Fallback) ----------------------!>
            print("⚠️ WARNING: AI Response is NOT a dictionary!")
            reply, total_tokens = ai_response if isinstance(ai_response, tuple) else (str(ai_response), 0)
            input_tokens = int(total_tokens * 0.5)
            output_tokens = total_tokens - input_tokens
            success = True

        try:
            #<! ----------------- Subtract spent tokens from profile --------------!>
            if success and total_tokens > 0:
                user_profile.word_balance = max(0, user_profile.word_balance - total_tokens)
                user_profile.save(update_fields=['word_balance'])
                print(f"Deducted {total_tokens} tokens. Remaining: {user_profile.word_balance}")
        except Exception as e:
            print(f"Error deducting tokens: {e}")  

        #<!----------------- 2. Response time calculation -----------------!>

        duration = int((time.time() - start_time) * 1000)

        # <! ----------------3. Saving data in TokenUsageLog ----------------!>

        from aiAgent.models import TokenUsageLog
        TokenUsageLog.objects.create(
            user=agent_config.user,
            ai_agent=agent_config,
            sender_id=sender_id,
            platform=data.get('type', 'messenger'),
            model_name=model_choice,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            response_time=duration,
            success=success,
            error_message=error_info,
            request_type=request_type if request_type else 'chat'
        )



        # <! ------------- save AI message ----------!>
        save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens)
    except Exception as e:
        print(f"AI Generation Error: {e}")
        reply = "I'm having some technical issues. Please wait a moment."
        total_tokens = 0
        
        from aiAgent.models import TokenUsageLog
        TokenUsageLog.objects.create(
            ai_agent = agent_config,
            sender_id = sender_id,
            success =False,
            error_message = str(e),
            model_name = model_choice
        )

    print(f' Reply : {reply} | Tokens Used : {total_tokens}')
    print(sender_id)

    print(">>> Calling Extractor Now!")
    try:
        handle_smart_memory_update(agent_config, sender_id, text)

    except Exception as e:
        print(f"Memory Handler Error: {e}")



    # n8n response webhook url
    N8N_RESPONSE_WEBHOOK = "https://n8n.newsmartagent.com/webhook/fb-comment-message-delivery"

    payload = {
        "sender_id": data.get('sender_id'),
        'reply': reply,
        'page_id': page_id,
        'page_access_token': page_access_token,
        'type': data.get('type'),
        'comment_id': data.get('comment_id'),
        'post_id': data.get('post_id')
    }


    print(f'Page ID : {page_id}')

    try:
        response = requests.post(N8N_RESPONSE_WEBHOOK, json=payload, timeout=10)
        print(f"Reply sent to n8n for {sender_id}")
        response.raise_for_status()
        print("Successfully sent reply back to n8n")

    except Exception as e:
        print(f'Failed to send reply to n8n: {e}')
