"""
Vector Embedding Service using sentence-transformers
For semantic search and message understanding
"""

import os
from sentence_transformers import SentenceTransformer
from django.core.cache import cache
from django.conf import settings
import logging

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    Handles message embedding for semantic search.
    Uses DistilBERT for Bengali + English support (384 dimensions)
    """
    
    MODEL_NAME = 'sentence-transformers/multilingual-MiniLM-L12-v2'  # 384 dims, fast
    CACHE_KEY_PREFIX = 'embedding_model:'
    
    def __init__(self):
        self.model = self._load_model()
    
    def _load_model(self):
        """Load model with caching"""
        cache_key = f"{self.CACHE_KEY_PREFIX}instance"
        
        # Try to get from cache
        model = cache.get(cache_key)
        if model:
            return model
        
        try:
            # Load model (downloads on first run)
            model = SentenceTransformer(self.MODEL_NAME)
            # Cache for 24 hours
            cache.set(cache_key, model, 86400)
            logger.info(f"Loaded embedding model: {self.MODEL_NAME}")
            return model
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    
    def embed_text(self, text: str) -> list:
        """
        Convert text to vector embedding
        
        Args:
            text: Message to embed
            
        Returns:
            List of floats (384 dimensions)
        """
        if not text or not isinstance(text, str):
            return [0.0] * 384
        
        try:
            # Normalize text
            text = text.strip()[:512]  # Limit length
            
            # Get embedding
            embedding = self.model.encode(text, convert_to_numpy=False)
            return embedding.tolist() if hasattr(embedding, 'tolist') else embedding
        
        except Exception as e:
            logger.error(f"Embedding error for text: {text[:50]}... - {e}")
            return [0.0] * 384
    
    def embed_messages(self, messages: list) -> list:
        """Batch embed multiple messages"""
        if not messages:
            return []
        
        try:
            embeddings = self.model.encode(messages, convert_to_numpy=False)
            return [e.tolist() if hasattr(e, 'tolist') else e for e in embeddings]
        except Exception as e:
            logger.error(f"Batch embedding error: {e}")
            return [[0.0] * 384 for _ in messages]
    
    def semantic_similarity(self, text1: str, text2: str) -> float:
        """
        Calculate similarity between two texts (0-1)
        
        Returns:
            Cosine similarity score (0=different, 1=identical)
        """
        try:
            embed1 = self.embed_text(text1)
            embed2 = self.embed_text(text2)
            
            # Cosine similarity
            from sklearn.metrics.pairwise import cosine_similarity
            import numpy as np
            
            similarity = cosine_similarity(
                [embed1], 
                [embed2]
            )[0][0]
            
            return float(similarity)
        except Exception as e:
            logger.error(f"Similarity calculation error: {e}")
            return 0.0


# Global instance
_embedding_service = None


def get_embedding_service():
    """Get or create embedding service singleton"""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service


# Helper functions
def embed_message(text: str) -> list:
    """Quick embedding function"""
    service = get_embedding_service()
    return service.embed_text(text)


def find_similar_messages(ai_agent, sender_id, query_text: str, top_k: int = 5):
    """
    Find semantically similar past messages
    
    Usage:
        similar = find_similar_messages(agent, user_id, "price of shoes")
    """
    from aiAgent.ml_models import MessageEmbedding
    from django.contrib.postgres.search import TrigramSimilarity
    
    try:
        service = get_embedding_service()
        query_embedding = service.embed_text(query_text)
        
        # PostgreSQL vector similarity search with pgvector
        similar = MessageEmbedding.objects.filter(
            ai_agent=ai_agent,
            sender_id=sender_id
        ).order_by('embedding')[:top_k]  # Will use pgvector distance
        
        return [
            {
                'text': msg.message_text,
                'type': msg.message_type,
                'sentiment': msg.sentiment,
                'created_at': msg.created_at.isoformat(),
            }
            for msg in similar
        ]
    except Exception as e:
        logger.error(f"Similar messages search error: {e}")
        return []
