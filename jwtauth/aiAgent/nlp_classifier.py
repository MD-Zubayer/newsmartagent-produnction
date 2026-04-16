"""
NLP Services for Intent & Sentiment Analysis
Uses transformers for Bengali + English multi-task classification
"""

import logging
from transformers import pipeline
from django.core.cache import cache
from django.conf import settings

logger = logging.getLogger(__name__)


class NLPClassifier:
    """
    Multi-task NLP classifier for:
    1. Message Intent (question, order, complaint, etc)
    2. Sentiment (positive, neutral, negative)
    3. Topic classification
    """
    
    def __init__(self):
        self.sentiment_pipeline = self._load_sentiment()
        self.intent_classifier = self._load_intent()
        self.zero_shot = self._load_zero_shot()
    
    def _load_sentiment(self):
        """Load sentiment analysis pipeline"""
        try:
            return pipeline(
                "sentiment-analysis",
                model="nlptown/bert-base-multilingual-uncased-sentiment",
                device=-1  # CPU, or 0 for GPU
            )
        except Exception as e:
            logger.error(f"Failed to load sentiment model: {e}")
            return None
    
    def _load_intent(self):
        """Load intent classification pipeline"""
        try:
            # Zero-shot classification works across languages
            return pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1
            )
        except Exception as e:
            logger.error(f"Failed to load intent model: {e}")
            return None
    
    def _load_zero_shot(self):
        """For flexible topic classification"""
        try:
            return pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1
            )
        except Exception as e:
            logger.error(f"Failed to load zero-shot model: {e}")
            return None
    
    def classify_sentiment(self, text: str) -> dict:
        """
        Analyze sentiment of message
        
        Returns:
            {
                'label': 'positive|neutral|negative',
                'score': 0.95,
                'all_scores': [...]
            }
        """
        if not text or not self.sentiment_pipeline:
            return {'label': 'neutral', 'score': 0.0, 'all_scores': []}
        
        try:
            # Limit text for performance
            text = text.strip()[:512]
            result = self.sentiment_pipeline(text, truncation=True)[0]
            
            # Map xlm-roberta labels to our labels
            label_map = {
                '5 stars': 'positive',
                '4 stars': 'positive',
                '3 stars': 'neutral',
                '2 stars': 'negative',
                '1 star': 'negative',
            }
            
            label = label_map.get(result['label'], 'neutral')
            
            return {
                'label': label,
                'score': result['score'],
                'raw_label': result['label']
            }
        
        except Exception as e:
            logger.error(f"Sentiment classification error: {e}")
            return {'label': 'neutral', 'score': 0.0, 'error': str(e)}
    
    def classify_intent(self, text: str) -> dict:
        """
        Classify user intent from message
        
        Returns:
            {
                'intent': 'product_inquiry',
                'score': 0.92,
                'candidates': [...]
            }
        """
        if not text or not self.intent_classifier:
            return {'intent': 'other', 'score': 0.0, 'candidates': []}
        
        try:
            text = text.strip()[:512]
            
            intent_labels = [
                'asking about product price',
                'ordering/purchasing product',
                'complaining about service',
                'asking for help/support',
                'greeting/casual chat',
                'providing feedback',
                'asking about availability',
                'delivery inquiry',
                'other'
            ]
            
            result = self.intent_classifier(text, intent_labels, multi_class=False)
            
            # Simplify labels
            intent_map = {
                'asking about product price': 'price_inquiry',
                'ordering/purchasing product': 'order',
                'complaining about service': 'complaint',
                'asking for help/support': 'support_request',
                'greeting/casual chat': 'greeting',
                'providing feedback': 'feedback',
                'asking about availability': 'availability_inquiry',
                'delivery inquiry': 'delivery_inquiry',
                'other': 'other'
            }
            
            top_intent = result['labels'][0]
            mapped_intent = intent_map.get(top_intent, 'other')
            
            return {
                'intent': mapped_intent,
                'score': result['scores'][0],
                'top_candidates': [
                    {
                        'label': intent_map.get(l, l),
                        'score': float(s)
                    }
                    for l, s in zip(result['labels'][:3], result['scores'][:3])
                ]
            }
        
        except Exception as e:
            logger.error(f"Intent classification error: {e}")
            return {'intent': 'other', 'score': 0.0, 'error': str(e)}
    
    def classify_topic(self, text: str, custom_topics: list = None) -> dict:
        """
        Classify message topic (product, price, delivery, etc)
        
        Args:
            text: Message text
            custom_topics: Custom topic list per agent
        """
        if not text or not self.zero_shot:
            return {'topic': 'other', 'score': 0.0}
        
        try:
            text = text.strip()[:512]
            
            # Default topics
            topics = custom_topics or [
                'product and features',
                'pricing and discounts',
                'delivery and shipping',
                'returns and refunds',
                'payment methods',
                'customer support',
                'general inquiry',
                'other'
            ]
            
            result = self.zero_shot(text, topics, multi_class=False)
            
            return {
                'topic': result['labels'][0],
                'score': result['scores'][0],
                'candidates': [
                    {'topic': l, 'score': float(s)}
                    for l, s in zip(result['labels'][:3], result['scores'][:3])
                ]
            }
        
        except Exception as e:
            logger.error(f"Topic classification error: {e}")
            return {'topic': 'other', 'score': 0.0, 'error': str(e)}


# Global instance
_nlp_classifier = None


def get_nlp_classifier():
    """Get or create NLP classifier singleton"""
    global _nlp_classifier
    if _nlp_classifier is None:
        _nlp_classifier = NLPClassifier()
    return _nlp_classifier


# Helper functions
def analyze_message(text: str, custom_topics: list = None) -> dict:
    """
    Complete analysis of message: sentiment + intent + topic
    
    Usage:
        analysis = analyze_message("আমি লাল জুতা কিনতে চাই, দাম কত?")
        # Returns:
        # {
        #     'sentiment': {'label': 'neutral', 'score': 0.8},
        #     'intent': {'intent': 'order', 'score': 0.9},
        #     'topic': {'topic': 'product', 'score': 0.85}
        # }
    """
    classifier = get_nlp_classifier()
    
    return {
        'sentiment': classifier.classify_sentiment(text),
        'intent': classifier.classify_intent(text),
        'topic': classifier.classify_topic(text, custom_topics)
    }
