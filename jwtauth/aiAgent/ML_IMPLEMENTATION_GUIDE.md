"""
ML IMPLEMENTATION GUIDE - Step by Step
======================================

This file contains the complete roadmap for implementing ML features
in your Newsmart Agent platform.
"""

# ==============================================================================
# PHASE 1: Setup & Database (2-3 hours)
# ==============================================================================

PHASE_1_TASKS = """
✅ Step 1.1: Install ML Dependencies
------
Command: pip install -r requirements.txt
(Already updated with sentence-transformers, transformers, torch, scikit-learn)

Installs:
- sentence-transformers (384-dim embeddings)
- transformers (for sentiment/intent models)
- scikit-learn (for ML models)
- pgvector (already in docker-compose)

Time: 15-20 minutes (first time downloads large models)


✅ Step 1.2: Create Database Migrations
------
Commands:
1. python manage.py makemigrations aiAgent
   (Creates migration for ml_models.py)

2. python manage.py migrate
   (Applies new models: MessageEmbedding, LeadScorePrediction, 
    ConversationAnalysis, MLMetrics)

Time: 5 minutes


✅ Step 1.3: Verify pgvector Extension
------
In PostgreSQL:
1. Connect to your database
2. Run: CREATE EXTENSION IF NOT EXISTS vector;
3. Test: SELECT * FROM pg_extension WHERE extname='vector';

OR in Django shell:
python manage.py dbshell
CREATE EXTENSION IF NOT EXISTS vector;

Time: 2 minutes


✅ Step 1.4: Create Required Directories
------
mkdir -p jwtauth/aiAgent/models/lead_scoring

These directories will store trained ML models for persistence.

Time: 1 minute
"""


# ==============================================================================
# PHASE 2: Integration (1-2 hours)
# ==============================================================================

PHASE_2_TASKS = """
✅ Step 2.1: Update Message Handler (CRITICAL)
------
File: jwtauth/aiAgent/views.py or wherever messages are processed

Add this to your message receive handler:

```python
from aiAgent.ml_integration import MLIntegration

def receive_message(request):
    # ... existing code ...
    
    message_text = request.data.get('message')
    agent = AgentAI.objects.get(id=agent_id)
    user_memory = UserMemory.objects.get(ai_agent=agent, sender_id=sender_id)
    
    # === ADD THIS ===
    ml_result = MLIntegration.process_incoming_message(
        ai_agent=agent,
        sender_id=sender_id,
        message_text=message_text,
        user_memory=user_memory
    )
    # === END ADD ===
    
    # Now use ml_result for smarter responses
    print(f"Intent: {ml_result['intent']['intent']}")
    print(f"Sentiment: {ml_result['sentiment']['label']}")
    print(f"Lead Quality: {ml_result['lead_score']['lead_quality']}")
    
    # ... generate response ...
```

Time: 15-30 minutes (per message handler)


✅ Step 2.2: Add Context to Response Generation
------
File: jwtauth/aiAgent/views.py or llm_service.py

Before calling LLM, enrich system prompt with ML insights:

```python
from aiAgent.ml_integration import MLIntegration

def generate_response(agent, sender_id, message_text):
    # Get ML context
    context = MLIntegration.get_user_context(agent, sender_id)
    
    # Enhance system prompt
    enhanced_prompt = f\"\"\"
    {original_system_prompt}
    
    Additional Context:
    - User Intent: {context['lead_quality'].get('quality', 'unknown')}
    - Conversation frequency: {context['conversation_analysis'].get('conversation_frequency')}
    - Top Topics: {', '.join(context['conversation_analysis'].get('top_topics', []))}
    \"\"\"
    
    # Call LLM with enriched prompt
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": enhanced_prompt},
            {"role": "user", "content": message_text}
        ]
    )
    
    return response['choices'][0]['message']['content']
```

Time: 15-20 minutes


✅ Step 2.3: Setup Async Processing (OPTIONAL but recommended)
------
File: jwtauth/settings.py

Add Celery configuration:

```python
# Celery Configuration
CELERY_BROKER_URL = 'redis://newsmartagent-redis:6379/0'
CELERY_RESULT_BACKEND = 'redis://newsmartagent-redis:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
```

Then in your message handler:
```python
from aiAgent.ml_hooks import process_message_ml_async

# Instead of blocking call:
# ml_result = MLIntegration.process_incoming_message(...)

# Use async (non-blocking):
process_message_ml_async.delay(
    agent_id=agent.id,
    sender_id=sender_id,
    message_text=message_text,
    user_memory_id=user_memory.id
)
```

Time: 20-30 minutes


✅ Step 2.4: Test Integration
------
Commands:
1. python manage.py shell

2. In shell:
```
from aiAgent.models import AgentAI, UserMemory
from aiAgent.ml_integration import MLIntegration

agent = AgentAI.objects.first()
memory = UserMemory.objects.first()

# Test ML pipeline
result = MLIntegration.process_incoming_message(
    ai_agent=agent,
    sender_id=memory.sender_id,
    message_text="আমি লাল জুতা কিনতে চাই, দাম কত?",
    user_memory=memory
)

print(result)
```

Expected output:
{
    'embedding': [0.12, 0.34, ...],
    'sentiment': {'label': 'neutral', 'score': 0.92},
    'intent': {'intent': 'order', 'score': 0.89},
    'topic': {'topic': 'product and features', 'score': 0.85},
    'lead_score': {'conversion_probability': 0.75, 'lead_quality': 'warm', ...},
    'message_id': 123
}

Time: 15 minutes
"""


# ==============================================================================
# PHASE 3: Data Population (30 mins - 2 hours)
# ==============================================================================

PHASE_3_TASKS = """
✅ Step 3.1: Populate Historical Data with Embeddings
------
Command:
python manage.py populate_ml_embeddings --limit 1000

This will:
1. Scan all existing UserMemory/chat_history
2. Generate embeddings for each message
3. Classify sentiment, intent, topic
4. Create ConversationAnalysis records
5. Store everything in database

Optional flags:
--agent-id=123      # Process specific agent only
--limit=5000        # Max messages to process

Time: 30 mins - 2 hours (depending on message volume)


✅ Step 3.2: Train Lead Scoring Model
------
Command:
python manage.py train_lead_model

This will:
1. Extract features from historical conversations
2. Label leads as converted/not-converted
3. Train RandomForest classifier
4. Save model to jwtauth/aiAgent/models/lead_scoring/

You need to manually label some leads first:
- Mark UserMemory with lead_status = 'converted', 'lost', or 'active'

Time: 15-30 minutes


✅ Step 3.3: Verify Data Population
------
In Django shell:
```
from aiAgent.ml_models import MessageEmbedding, ConversationAnalysis

# Check embeddings
msg_count = MessageEmbedding.objects.count()
print(f"Embeddings: {msg_count}")

# Check analysis
conv_count = ConversationAnalysis.objects.count()
print(f"Conversations analyzed: {conv_count}")
```

Expected: Both counts > 0
"""


# ==============================================================================
# PHASE 4: Features & Optimization (ongoing)
# ==============================================================================

PHASE_4_FEATURES = """
Feature 1: Lead Scoring Dashboard
---
Show lead quality distribution in admin

File: jwtauth/aiAgent/admin.py

from django.contrib import admin
from aiAgent.ml_models import LeadScorePrediction

@admin.register(LeadScorePrediction)
class LeadScoringAdmin(admin.ModelAdmin):
    list_display = ('user_memory', 'conversion_probability', 'lead_quality')
    list_filter = ('lead_quality', 'created_at')
    search_fields = ('user_memory__sender_id',)


Feature 2: Smart Routing
---
Route conversations based on intent/sentiment

File: jwtauth/aiAgent/services.py

def should_escalate_to_support(ml_result):
    sentiment = ml_result['sentiment']['label']
    intent = ml_result['intent']['intent']
    
    # Escalate complaints
    if sentiment == 'negative' and intent == 'complaint':
        return True
    
    # Escalate urgent support
    if intent == 'support_request' and sentiment == 'negative':
        return True
    
    return False


Feature 3: Churn Detection
---
Identify users likely to churn (stop using)

if last_interaction > 30 days and conversation_frequency == 'sporadic':
    send_re_engagement_campaign()


Feature 4: FAQ Auto-Response
---
Use semantic search to find FAQ answers

similar = MLIntegration.search_similar_conversations(agent, query)
if similar and similar[0]['sentiment'] == 'positive':
    return f"Based on similar queries: {similar[0]['message']}"


Feature 5: Personalized System Prompt
---
Adapt behavior per user

context = MLIntegration.get_user_context(agent, sender_id)
if context['lead_quality']['quality'] == 'hot':
    prompt += \"\\nThis is a high-value customer. Prioritize their request.\"
"""


# ==============================================================================
# TROUBLESHOOTING
# ==============================================================================

TROUBLESHOOTING = """
Problem: "No module named 'sentence_transformers'"
---
Solution: pip install sentence-transformers

Problem: "pgvector extension not found"
---
Solution: Docker command:
docker exec <postgres_container> psql -U postgres -d <db_name> -c 'CREATE EXTENSION IF NOT EXISTS vector;'

Problem: "Model takes too long to load"
---
Solution: Models are cached after first load. Next requests are fast.
Or use GPU: set device=cuda in nlp_classifier.py

Problem: "Vector similarity search not working"
---
Solution: Ensure pgvector installed and CREATE EXTENSION ran
Check: SELECT extname FROM pg_extension WHERE extname='vector';

Problem: "Lead scoring always returns 0.5"
---
Solution: Model needs training data. Run:
python manage.py train_lead_model
(After manually labeling some leads)
"""


# ==============================================================================
# PERFORMANCE TIPS
# ==============================================================================

PERFORMANCE_TIPS = """
1. Use Async for ML Processing
   - Don't block message response for ML
   - Use Celery tasks as shown in ml_hooks.py
   - Process in background

2. Cache Embeddings
   - Same text → same embedding (reuse)
   - Redis caching built-in

3. Batch Processing
   - Process multiple messages together
   - Use: get_embedding_service().embed_messages(texts)

4. Database Optimization
   - Vector search: CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops)
   - Periodic cleanup of old embeddings

5. Model Selection
   - MiniLM (384 dims) vs MPNET (768 dims)
   - Trade-off: speed vs accuracy
   - Change in embedding_service.py MODEL_NAME

6. GPU Usage
   - Set device='cuda' in nlp_classifier.py for faster inference
   - Requires: nvidia-cuda-toolkit, torch with CUDA support
"""


# ==============================================================================
# QUICK START CHECKLIST
# ==============================================================================

QUICK_START = """
Day 1 (2-3 hours):
□ pip install -r requirements.txt
□ python manage.py makemigrations aiAgent
□ python manage.py migrate
□ Setup pgvector: CREATE EXTENSION vector;

Day 2 (1-2 hours):
□ Add MLIntegration.process_incoming_message() to message handlers
□ Test with: python manage.py shell + sample message

Day 3 (30 mins):
□ python manage.py populate_ml_embeddings --limit=1000
□ Verify: MessageEmbedding.objects.count() > 0

Day 4 (optional):
□ Setup Lead Scoring training
□ Add Dashboard views
□ Deploy and monitor

That's it! You now have:
✅ Vector embeddings for semantic search
✅ Sentiment analysis
✅ Intent classification
✅ Lead scoring predictions
✅ Conversation analytics
"""

print(QUICK_START)
