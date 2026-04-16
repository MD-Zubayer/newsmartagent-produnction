"""
Lead Scoring ML Model

Predicts likelihood of lead conversion based on:
- Message frequency
- Sentiment patterns
- Intent signals
- Conversation history
- Time-based features
"""

import logging
import numpy as np
import pandas as pd
from datetime import timedelta, datetime
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

logger = logging.getLogger(__name__)


class LeadScoringModel:
    """
    ML model for predicting lead conversion probability
    """
    
    def __init__(self, model_path=None):
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = [
            'message_frequency',
            'avg_message_length',
            'sentiment_positivity',
            'intent_purchase_score',
            'conversation_depth',
            'response_engagement',
            'days_active',
            'last_activity_recency',
            'price_inquiry_count',
            'order_intent_count',
            'question_count',
        ]
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            self._init_default_model()
    
    def _init_default_model(self):
        """Initialize with default model (Random Forest)"""
        try:
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
            logger.info("Initialized default lead scoring model")
        except Exception as e:
            logger.error(f"Failed to init lead scoring model: {e}")
    
    def extract_features(self, ai_agent, sender_id, conversation_data: dict) -> dict:
        """
        Extract features from conversation history
        
        Args:
            ai_agent: AgentAI instance
            sender_id: User ID
            conversation_data: {
                'messages': [...],  # List of messages
                'user_memory': {...},  # UserMemory data
                'metadata': {...}
            }
        
        Returns:
            Dict of feature values
        """
        try:
            messages = conversation_data.get('messages', [])
            memory = conversation_data.get('user_memory', {})
            
            if not messages:
                return self._get_zero_features()
            
            # 1. Message frequency
            message_frequency = len(messages)
            
            # 2. Average message length
            avg_msg_length = np.mean([len(m.get('text', '')) for m in messages]) if messages else 0
            
            # 3. Sentiment positivity
            sentiments = [m.get('sentiment', 0) for m in messages if 'sentiment' in m]
            sentiment_positivity = np.mean(sentiments) if sentiments else 0.5
            
            # 4. Intent purchase score (order/purchase heavy)
            intents = [m.get('intent', '') for m in messages]
            purchase_count = sum(1 for i in intents if 'order' in i or 'purchase' in i)
            intent_purchase_score = purchase_count / max(len(intents), 1)
            
            # 5. Conversation depth (mix of messages and topics)
            unique_topics = len(set(m.get('topic', '') for m in messages))
            conversation_depth = unique_topics / max(len(messages), 1)
            
            # 6. Response engagement (message back-and-forth)
            response_engagement = min(len(messages) / 10, 1.0)  # Normalize
            
            # 7. Days active (first to last message)
            if len(messages) > 1:
                timestamps = [m.get('timestamp', datetime.now()) for m in messages if 'timestamp' in m]
                if timestamps:
                    days_active = (max(timestamps) - min(timestamps)).days
                else:
                    days_active = 0
            else:
                days_active = 0
            
            # 8. Last activity recency (higher = more recent)
            last_msg = messages[-1] if messages else None
            if last_msg and 'timestamp' in last_msg:
                days_since = (datetime.now() - last_msg['timestamp']).days
                last_activity_recency = 1.0 / (1.0 + days_since)  # 0-1 scale
            else:
                last_activity_recency = 0.5
            
            # 9. Price inquiry count
            price_inquiry_count = sum(1 for m in messages if 'price' in m.get('text', '').lower())
            
            # 10. Order intent count
            order_intent_count = purchase_count
            
            # 11. Question count
            question_count = sum(1 for m in messages if m.get('text', '').strip().endswith('?'))
            
            # Normalize counts
            total_msgs = max(len(messages), 1)
            
            return {
                'message_frequency': min(message_frequency / 20, 1.0),  # Normalize
                'avg_message_length': min(avg_msg_length / 200, 1.0),
                'sentiment_positivity': sentiment_positivity,
                'intent_purchase_score': intent_purchase_score,
                'conversation_depth': conversation_depth,
                'response_engagement': response_engagement,
                'days_active': min(days_active / 365, 1.0),  # Normalize to 0-1
                'last_activity_recency': last_activity_recency,
                'price_inquiry_count': min(price_inquiry_count / total_msgs, 1.0),
                'order_intent_count': min(order_intent_count / total_msgs, 1.0),
                'question_count': min(question_count / total_msgs, 1.0),
            }
        
        except Exception as e:
            logger.error(f"Feature extraction error: {e}")
            return self._get_zero_features()
    
    def _get_zero_features(self):
        """Return zero feature vector"""
        return {name: 0.0 for name in self.feature_names}
    
    def predict_lead_score(self, features: dict) -> dict:
        """
        Predict lead quality and conversion probability
        
        Returns:
            {
                'conversion_probability': 0.75,
                'lead_quality': 'warm',  # hot, warm, cold, lost
                'signals': {...},  # Feature importance
                'confidence': 0.82
            }
        """
        if not self.model:
            return {
                'conversion_probability': 0.5,
                'lead_quality': 'cold',
                'signals': features,
                'confidence': 0.0
            }
        
        try:
            # Prepare feature vector
            X = np.array([[features.get(name, 0.0) for name in self.feature_names]])
            
            # Scale features
            X_scaled = self.scaler.transform(X)
            
            # Get prediction probability
            proba = self.model.predict_proba(X_scaled)[0]
            conversion_prob = proba[1] if len(proba) > 1 else 0.5
            
            # Classify lead quality
            if conversion_prob > 0.7:
                quality = 'hot'
            elif conversion_prob > 0.5:
                quality = 'warm'
            elif conversion_prob > 0.2:
                quality = 'cold'
            else:
                quality = 'lost'
            
            # Feature importance
            if hasattr(self.model, 'feature_importances_'):
                importance = dict(zip(self.feature_names, self.model.feature_importances_))
            else:
                importance = {}
            
            return {
                'conversion_probability': float(conversion_prob),
                'lead_quality': quality,
                'confidence': 0.75,  # Placeholder
                'signals': importance,
                'raw_features': features
            }
        
        except Exception as e:
            logger.error(f"Lead prediction error: {e}")
            return {
                'conversion_probability': 0.5,
                'lead_quality': 'cold',
                'signals': features,
                'confidence': 0.0,
                'error': str(e)
            }
    
    def train(self, training_data: list):
        """
        Train model on historical data
        
        Args:
            training_data: List of tuples (features_dict, label)
                where label = 0 (not converted) or 1 (converted)
        """
        try:
            if not training_data:
                logger.warning("No training data provided")
                return False
            
            X = np.array([
                [f.get(name, 0.0) for name in self.feature_names]
                for f, _ in training_data
            ])
            y = np.array([label for _, label in training_data])
            
            # Scale features
            X_scaled = self.scaler.fit_transform(X)
            
            # Train model
            self.model.fit(X_scaled, y)
            
            logger.info(f"Lead scoring model trained on {len(training_data)} samples")
            return True
        
        except Exception as e:
            logger.error(f"Model training error: {e}")
            return False
    
    def save_model(self, path: str):
        """Save model to disk"""
        try:
            joblib.dump(self.model, f"{path}/model.pkl")
            joblib.dump(self.scaler, f"{path}/scaler.pkl")
            joblib.dump(self.feature_names, f"{path}/feature_names.pkl")
            logger.info(f"Model saved to {path}")
            return True
        except Exception as e:
            logger.error(f"Model save error: {e}")
            return False
    
    def load_model(self, path: str):
        """Load model from disk"""
        try:
            self.model = joblib.load(f"{path}/model.pkl")
            self.scaler = joblib.load(f"{path}/scaler.pkl")
            self.feature_names = joblib.load(f"{path}/feature_names.pkl")
            logger.info(f"Model loaded from {path}")
            return True
        except Exception as e:
            logger.error(f"Model load error: {e}")
            return False


# Global instance
_lead_scoring_model = None


def get_lead_scoring_model():
    """Get or create lead scoring model singleton"""
    global _lead_scoring_model
    if _lead_scoring_model is None:
        model_path = os.path.join(
            os.path.dirname(__file__),
            'models',
            'lead_scoring'
        )
        _lead_scoring_model = LeadScoringModel(model_path)
    return _lead_scoring_model


def score_lead(ai_agent, sender_id, conversation_data: dict) -> dict:
    """
    Quick function to score a lead
    
    Usage:
        score = score_lead(agent, user_id, conversation_data)
    """
    model = get_lead_scoring_model()
    features = model.extract_features(ai_agent, sender_id, conversation_data)
    return model.predict_lead_score(features)
