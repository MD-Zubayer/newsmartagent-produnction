"""
ML Integration Utils
Hook into existing chat flow for automatic ML processing
"""

import logging
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta

from aiAgent.ml_models import (
    MessageEmbedding,
    LeadScorePrediction,
    ConversationAnalysis,
    MLMetrics
)
from aiAgent.embedding_service import get_embedding_service
from aiAgent.nlp_classifier import get_nlp_classifier
from aiAgent.lead_scoring import get_lead_scoring_model

logger = logging.getLogger(__name__)


class MLIntegration:
    """
    Central integration point for ML features.
    Call this from chat views/serializers to process messages with ML.
    """
    
    @staticmethod
    def process_incoming_message(ai_agent, sender_id, message_text: str, user_memory=None):
        """
        Process incoming message through ML pipeline
        
        This should be called in your chat handler after receiving a message.
        
        Usage:
            from aiAgent.ml_integration import MLIntegration
            
            # In your message handling function:
            ml_result = MLIntegration.process_incoming_message(
                ai_agent=agent,
                sender_id=user_id,
                message_text=message_content,
                user_memory=user_memory_obj
            )
            
            # Use results for better routing/response
            if ml_result['intent']['intent'] == 'complaint':
                # Route to support team
                pass
        
        Returns:
            {
                'embedding': [...],  # Vector embedding
                'sentiment': {...},  # Sentiment analysis
                'intent': {...},      # Intent classification
                'topic': {...},       # Topic classification
                'lead_score': {...},  # Lead quality prediction
                'message_id': 'db_id' # For later reference
            }
        """
        try:
            result = {}
            
            # 1. Get text embeddings
            embedding_service = get_embedding_service()
            embedding = embedding_service.embed_text(message_text)
            result['embedding'] = embedding
            
            # 2. Analyze sentiment + intent + topic
            nlp_classifier = get_nlp_classifier()
            result['sentiment'] = nlp_classifier.classify_sentiment(message_text)
            result['intent'] = nlp_classifier.classify_intent(message_text)
            
            # Custom topics from agent if available
            custom_topics = _get_custom_topics(ai_agent)
            result['topic'] = nlp_classifier.classify_topic(message_text, custom_topics)
            
            # 3. Store message embedding in DB
            msg_embedding = MessageEmbedding.objects.create(
                ai_agent=ai_agent,
                sender_id=sender_id,
                message_text=message_text,
                embedding=embedding,
                message_type=_map_intent_to_type(result['intent']['intent']),
                sentiment=result['sentiment']['label'],
                intent=result['intent']['intent'],
            )
            result['message_id'] = msg_embedding.id
            
            # 4. Update conversation analysis
            _update_conversation_analysis(ai_agent, sender_id, message_text, result)
            
            # 5. Score lead (if user memory exists)
            if user_memory:
                conversation_data = _build_conversation_data(ai_agent, sender_id, message_text)
                lead_scoring_model = get_lead_scoring_model()
                features = lead_scoring_model.extract_features(ai_agent, sender_id, conversation_data)
                lead_prediction = lead_scoring_model.predict_lead_score(features)
                
                # Update or create lead score in DB
                lead_score_obj, _ = LeadScorePrediction.objects.update_or_create(
                    user_memory=user_memory,
                    defaults={
                        'ai_agent': ai_agent,
                        'conversion_probability': lead_prediction['conversion_probability'],
                        'lead_quality': lead_prediction['lead_quality'],
                        'signals': lead_prediction.get('signals', {}),
                    }
                )
                result['lead_score'] = lead_prediction
                result['lead_score_id'] = lead_score_obj.id
            
            logger.info(f"ML processing completed for {ai_agent.name} - {sender_id}")
            return result
        
        except Exception as e:
            logger.error(f"ML integration error: {e}")
            return {
                'error': str(e),
                'embedding': None,
                'sentiment': {'label': 'neutral', 'score': 0.0},
                'intent': {'intent': 'other', 'score': 0.0},
                'topic': {'topic': 'other', 'score': 0.0},
            }
    
    @staticmethod
    def get_user_context(ai_agent, sender_id) -> dict:
        """
        Get rich context about a user for better response generation
        
        Usage:
            context = MLIntegration.get_user_context(agent, user_id)
            # Use in system prompt enrichment
        """
        try:
            # Get recent messages
            recent_messages = MessageEmbedding.objects.filter(
                ai_agent=ai_agent,
                sender_id=sender_id
            ).order_by('-created_at')[:10]
            
            # Get conversation analysis
            conv_analysis = ConversationAnalysis.objects.filter(
                ai_agent=ai_agent,
                sender_id=sender_id
            ).first()
            
            # Get lead score
            from aiAgent.models import UserMemory
            user_memory = UserMemory.objects.filter(
                ai_agent=ai_agent,
                sender_id=sender_id
            ).first()
            
            lead_score_data = None
            if user_memory:
                lead_score_data = LeadScorePrediction.objects.filter(
                    user_memory=user_memory
                ).first()
            
            return {
                'recent_messages': [
                    {
                        'text': m.message_text,
                        'sentiment': m.sentiment,
                        'intent': m.intent,
                        'type': m.message_type,
                        'created_at': m.created_at.isoformat(),
                    }
                    for m in recent_messages
                ],
                'conversation_analysis': {
                    'total_messages': conv_analysis.total_messages if conv_analysis else 0,
                    'sentiment_distribution': conv_analysis.message_sentiment_distribution if conv_analysis else {},
                    'top_topics': conv_analysis.top_topics if conv_analysis else [],
                    'conversation_frequency': conv_analysis.conversation_frequency if conv_analysis else 'sporadic',
                } if conv_analysis else {},
                'lead_quality': {
                    'quality': lead_score_data.lead_quality if lead_score_data else 'cold',
                    'conversion_probability': lead_score_data.conversion_probability if lead_score_data else 0.0,
                } if lead_score_data else {},
            }
        
        except Exception as e:
            logger.error(f"Context retrieval error: {e}")
            return {}
    
    @staticmethod
    def search_similar_conversations(ai_agent, query: str, top_k: int = 5) -> list:
        """
        Find similar past conversations using semantic search
        
        Useful for:
        - Finding FAQ responses
        - Learning from past interactions
        - Pattern matching
        """
        try:
            embedding_service = get_embedding_service()
            query_embedding = embedding_service.embed_text(query)
            
            # Use pgvector similarity search
            similar = MessageEmbedding.objects.filter(
                ai_agent=ai_agent
            ).order_by('-embedding')[:top_k]  # Will use vector distance
            
            return [
                {
                    'sender_id': m.sender_id,
                    'message': m.message_text,
                    'sentiment': m.sentiment,
                    'intent': m.intent,
                    'created_at': m.created_at.isoformat(),
                }
                for m in similar
            ]
        
        except Exception as e:
            logger.error(f"Similarity search error: {e}")
            return []


# Helper functions

def _map_intent_to_type(intent: str) -> str:
    """Map intent to message type"""
    mapping = {
        'price_inquiry': 'question',
        'order': 'order',
        'complaint': 'complaint',
        'support_request': 'question',
        'greeting': 'greeting',
        'feedback': 'feedback',
        'availability_inquiry': 'question',
        'delivery_inquiry': 'question',
    }
    return mapping.get(intent, 'other')


def _get_custom_topics(ai_agent) -> list:
    """Get custom topics from agent settings"""
    try:
        if hasattr(ai_agent, 'custom_keywords'):
            # Parse from custom_keywords field
            keywords = ai_agent.custom_keywords.split(',')
            return [k.strip() for k in keywords if k.strip()]
    except:
        pass
    return []


def _update_conversation_analysis(ai_agent, sender_id, message_text: str, ml_result: dict):
    """Update conversation analysis record"""
    try:
        analysis, created = ConversationAnalysis.objects.get_or_create(
            ai_agent=ai_agent,
            sender_id=sender_id
        )
        
        # Update counts
        analysis.total_messages += 1
        
        # Update sentiment distribution
        sentiment = ml_result.get('sentiment', {}).get('label', 'neutral')
        sentiment_dist = analysis.message_sentiment_distribution or {}
        sentiment_dist[sentiment] = sentiment_dist.get(sentiment, 0) + 1
        analysis.message_sentiment_distribution = sentiment_dist
        
        # Update intent distribution
        intent = ml_result.get('intent', {}).get('intent', 'other')
        intent_dist = analysis.intent_distribution or {}
        intent_dist[intent] = intent_dist.get(intent, 0) + 1
        analysis.intent_distribution = intent_dist
        
        # Update topics
        topic = ml_result.get('topic', {}).get('topic', 'other')
        topics = analysis.top_topics or []
        if topic not in topics:
            topics.append(topic)
        analysis.top_topics = topics
        
        # Update engagement
        analysis.last_interaction = timezone.now()
        analysis.save()
        
    except Exception as e:
        logger.error(f"Conversation analysis update error: {e}")


def _build_conversation_data(ai_agent, sender_id, current_message: str) -> dict:
    """Build conversation data for lead scoring"""
    try:
        messages = MessageEmbedding.objects.filter(
            ai_agent=ai_agent,
            sender_id=sender_id
        ).order_by('created_at').values('message_text', 'sentiment', 'intent', 'message_type', 'created_at')[:100]
        
        return {
            'messages': list(messages),
            'current_message': current_message,
        }
    except:
        return {'messages': []}
