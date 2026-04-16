"""
Integration hooks for message handling
Add these calls to your existing message processing pipeline
"""

# === COPY THESE INTO YOUR MESSAGE HANDLING VIEWS/SERIALIZERS ===

# Option 1: Add to message receive handler
# Example: aiAgent/views.py or wherever messages are processed

def process_message_with_ml(ai_agent, sender_id, message_text, user_memory=None):
    """
    Process text message with ML pipeline
    Call this after receiving a message from any platform
    """
    from aiAgent.ml_integration import MLIntegration
    
    ml_result = MLIntegration.process_incoming_message(
        ai_agent=ai_agent,
        sender_id=sender_id,
        message_text=message_text,
        user_memory=user_memory
    )
    
    return ml_result


# Option 2: Celery task for async processing (non-blocking)
from celery import shared_task
from aiAgent.models import AgentAI
import json


@shared_task(bind=True, max_retries=3)
def process_message_ml_async(self, agent_id, sender_id, message_text, user_memory_id=None):
    """
    Async ML processing to avoid blocking message response
    """
    try:
        from aiAgent.ml_integration import MLIntegration
        from aiAgent.models import UserMemory
        
        agent = AgentAI.objects.get(id=agent_id)
        user_memory = None
        
        if user_memory_id:
            user_memory = UserMemory.objects.get(id=user_memory_id)
        
        result = MLIntegration.process_incoming_message(
            ai_agent=agent,
            sender_id=sender_id,
            message_text=message_text,
            user_memory=user_memory
        )
        
        return result
    
    except Exception as exc:
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60)


# === USAGE EXAMPLES ===

"""
Example 1: Sync processing (immediate)
----

from aiAgent.views import process_message_with_ml
from aiAgent.models import AgentAI, UserMemory

def handle_whatsapp_message(request):
    message_text = request.data.get('text')
    agent_id = request.data.get('agent_id')
    sender_id = request.data.get('sender_id')
    
    agent = AgentAI.objects.get(id=agent_id)
    user_memory = UserMemory.objects.get(ai_agent=agent, sender_id=sender_id)
    
    # Process with ML
    ml_result = process_message_with_ml(agent, sender_id, message_text, user_memory)
    
    # Use ML insights for better response
    if ml_result['intent']['intent'] == 'complaint':
        # Route to support team
        notify_support(sender_id)
    
    if ml_result['lead_score']['lead_quality'] == 'hot':
        # Trigger special offer
        send_offer(sender_id)
    
    # Generate response
    response = generate_response(message_text, ml_result)
    return response


Example 2: Async processing (non-blocking)
----

from aiAgent.views import process_message_ml_async

def handle_message_async(request):
    message_text = request.data.get('text')
    agent_id = request.data.get('agent_id')
    sender_id = request.data.get('sender_id')
    user_memory_id = request.data.get('user_memory_id')
    
    # Queue ML processing (returns immediately)
    process_message_ml_async.delay(
        agent_id=agent_id,
        sender_id=sender_id,
        message_text=message_text,
        user_memory_id=user_memory_id
    )
    
    # Generate response without waiting for ML
    quick_response = get_quick_response(message_text)
    return quick_response


Example 3: Get user context in response generation
----

from aiAgent.ml_integration import MLIntegration

def generate_contextual_response(agent, sender_id, message_text):
    # Get rich user context
    context = MLIntegration.get_user_context(agent, sender_id)
    
    # Enhance system prompt
    context_snippet = f\"\"\"
    User Profile:
    - Recent intent: {context['lead_quality'].get('lead_quality', 'unknown')}
    - Conversation frequency: {context['conversation_analysis'].get('conversation_frequency', 'sporadic')}
    - Top topics: {', '.join(context['conversation_analysis'].get('top_topics', []))}
    \"\"\"
    
    # Use in LLM prompt
    response = call_llm(
        message_text,
        system_prompt=system_prompt + context_snippet
    )
    
    return response


Example 4: Semantic search for similar conversations
----

from aiAgent.ml_integration import MLIntegration

def find_faq_response(agent, query):
    # Find similar past conversations
    similar = MLIntegration.search_similar_conversations(agent, query, top_k=3)
    
    if similar:
        # Use past response as template
        past_response = similar[0]
        return f"Based on similar queries: {past_response['message']}"
    
    return None


Example 5: Lead scoring workflow
----

from aiAgent.ml_integration import MLIntegration

def route_to_sales(agent, sender_id, user_memory):
    context = MLIntegration.get_user_context(agent, sender_id)
    
    lead_quality = context.get('lead_quality', {}).get('quality', 'cold')
    conversion_prob = context.get('lead_quality', {}).get('conversion_probability', 0)
    
    if lead_quality == 'hot' and conversion_prob > 0.8:
        # Immediate sales follow-up
        send_to_sales_team(sender_id, priority='high')
    
    elif lead_quality == 'warm' and conversion_prob > 0.5:
        # Schedule follow-up in 24h
        schedule_followup(sender_id, delay_hours=24)
    
    else:
        # Nurture campaign
        send_nurture_content(sender_id)
"""


# === DJANGO SETTINGS CONFIGURATION ===

"""
Add to your settings.py:

# ML/NLP Configuration
ML_CONFIG = {
    'embedding_model': 'sentence-transformers/multilingual-MiniLM-L12-v2',
    'embedding_dimensions': 384,
    'nlp_device': 'cpu',  # or 'cuda' for GPU
    'cache_embeddings': True,
    'cache_timeout': 86400,  # 24 hours
}

# If using async:
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
"""
