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


class Document(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents')
    title = models.CharField(max_length=255, default='Untitled Document')
    
    # 🔥 নতুুন যুক্ত করা হয়েছে (Scope Control)
    KNOWLEDGE_SCOPE = [
        ('global', 'Global (All Agents)'),
        ('agent_specific', 'Agent Specific'),
    ]
    scope = models.CharField(max_length=20, choices=KNOWLEDGE_SCOPE, default='global')
    agent = models.ForeignKey('aiAgent.AgentAI', on_delete=models.SET_NULL, null=True, blank=True, related_name='knowledge_documents')

    full_content = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} - {self.user.email}"

    class Meta:
        ordering = ['-updated_at']


class DocumentKnowledge(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='document_knowledge')
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='chunks', null=True, blank=True)
    doc_title = models.CharField(max_length=255, blank=True)
    chunk_index = models.IntegerField(default=0)
    content_hash = models.CharField(max_length=64, db_index=True, null=True, blank=True)
    content = models.TextField()
    embedding = VectorField(dimensions=768, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            HnswIndex(
                name='doc_vector_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            )
        ]

    def __str__(self):
        return f"{self.user.email} - {self.doc_title} (Chunk {self.chunk_index})"
