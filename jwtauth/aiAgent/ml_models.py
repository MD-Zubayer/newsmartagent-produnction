"""
ML Models for advanced AI features:
1. Vector embeddings for semantic search
2. Lead scoring predictions
3. Intent/Sentiment classification
"""

from django.db import models
from django.conf import settings
from pgvector.django import VectorField
import json


class MessageEmbedding(models.Model):
    """Store vector embeddings of messages for semantic search"""
    ai_agent = models.ForeignKey(
        'aiAgent.AgentAI', 
        on_delete=models.CASCADE, 
        related_name='message_embeddings'
    )
    sender_id = models.CharField(max_length=255, db_index=True)
    message_text = models.TextField()
    embedding = VectorField(dimensions=384)  # Using sentence-transformers (DistilBERT)
    
    # Metadata
    message_type = models.CharField(
        max_length=50,
        choices=[
            ('question', 'Question'),
            ('complaint', 'Complaint'),
            ('order', 'Order/Purchase'),
            ('greeting', 'Greeting'),
            ('feedback', 'Feedback'),
            ('other', 'Other')
        ],
        default='other'
    )
    sentiment = models.CharField(
        max_length=20,
        choices=[
            ('positive', 'Positive'),
            ('neutral', 'Neutral'),
            ('negative', 'Negative'),
        ],
        default='neutral'
    )
    intent = models.CharField(max_length=100, blank=True, help_text="Detected intent from message")
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['ai_agent', 'sender_id', 'created_at']),
        ]
    
    def __str__(self):
        return f"{self.ai_agent.name} - {self.sender_id}: {self.message_text[:50]}"


class LeadScorePrediction(models.Model):
    """Store ML-predicted lead scores"""
    ai_agent = models.ForeignKey(
        'aiAgent.AgentAI', 
        on_delete=models.CASCADE,
        related_name='lead_scores'
    )
    user_memory = models.OneToOneField(
        'aiAgent.UserMemory',
        on_delete=models.CASCADE,
        related_name='lead_score'
    )
    
    # Scoring
    conversion_probability = models.FloatField(default=0.0, help_text="0.0-1.0 probability")
    engagement_score = models.FloatField(default=0.0)  # Based on interaction frequency
    purchase_intent_score = models.FloatField(default=0.0)  # Based on conversation
    
    # Classification
    lead_quality = models.CharField(
        max_length=20,
        choices=[
            ('hot', 'Hot - Ready to convert'),
            ('warm', 'Warm - Interested'),
            ('cold', 'Cold - Low intent'),
            ('lost', 'Lost - Unlikely to convert'),
        ],
        default='cold'
    )
    
    # Signals
    signals = models.JSONField(default=dict, help_text="Dict of signals used in prediction")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_prediction_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.ai_agent.name} - {self.user_memory.sender_id}: {self.lead_quality}"


class ConversationAnalysis(models.Model):
    """Detailed conversation analytics per user"""
    ai_agent = models.ForeignKey(
        'aiAgent.AgentAI',
        on_delete=models.CASCADE,
        related_name='conversation_analyses'
    )
    sender_id = models.CharField(max_length=255, db_index=True)
    
    # Metrics
    total_messages = models.IntegerField(default=0)
    avg_response_time = models.FloatField(default=0.0, help_text="in seconds")
    message_sentiment_distribution = models.JSONField(
        default=dict, 
        help_text="{'positive': 0.5, 'neutral': 0.3, 'negative': 0.2}"
    )
    
    # Topics
    top_topics = models.JSONField(
        default=list,
        help_text="['product_inquiry', 'pricing', 'delivery']"
    )
    intent_distribution = models.JSONField(
        default=dict,
        help_text="{'question': 0.4, 'order': 0.3, ...}"
    )
    
    # Engagement
    last_interaction = models.DateTimeField(null=True, blank=True)
    days_since_last_interaction = models.IntegerField(default=0)
    conversation_frequency = models.CharField(
        max_length=20,
        choices=[
            ('daily', 'Daily'),
            ('weekly', 'Weekly'),
            ('monthly', 'Monthly'),
            ('sporadic', 'Sporadic'),
        ],
        default='sporadic'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('ai_agent', 'sender_id')
        indexes = [
            models.Index(fields=['ai_agent', 'sender_id']),
        ]
    
    def __str__(self):
        return f"{self.ai_agent.name} - {self.sender_id}"


class MLMetrics(models.Model):
    """Track ML model performance metrics"""
    METRIC_TYPES = [
        ('embedding_quality', 'Embedding Quality'),
        ('lead_score_accuracy', 'Lead Score Accuracy'),
        ('sentiment_accuracy', 'Sentiment Analysis Accuracy'),
        ('intent_accuracy', 'Intent Classification Accuracy'),
    ]
    
    ai_agent = models.ForeignKey(
        'aiAgent.AgentAI',
        on_delete=models.CASCADE,
        related_name='ml_metrics'
    )
    
    metric_type = models.CharField(max_length=50, choices=METRIC_TYPES)
    metric_name = models.CharField(max_length=100)
    metric_value = models.FloatField()
    
    # Context
    evaluation_date = models.DateField(auto_now_add=True)
    sample_size = models.IntegerField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['ai_agent', 'metric_type', 'evaluation_date']),
        ]
    
    def __str__(self):
        return f"{self.ai_agent.name} - {self.metric_name}: {self.metric_value:.4f}"
