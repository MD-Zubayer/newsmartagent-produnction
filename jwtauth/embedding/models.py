from django.db import models
from pgvector.django import VectorField, HnswIndex
from django.contrib.auth import get_user_model 
# Create your models here.

User = get_user_model()

class SpreadsheetKnowledge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='knowledge_base')
    row_id = models.CharField(max_length=50)
    content = models.TextField()
    column_hashes = models.JSONField(default=dict)
    embedding = VectorField(dimensions=768, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


    class Meta:
        indexes = [
            HnswIndex(
                name='vector_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            )
        ]

    def __str__(self):
        return f"{self.user.email}"

