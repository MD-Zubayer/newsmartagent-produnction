from django.db import models
from pgvector.django import VectorField, HnswIndex
from django.contrib.auth import get_user_model 
# Create your models here.

User = get_user_model()

class SpreadsheetKnowledge(models.Model):
    IMAGE_SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('auto_search', 'Auto Search'),
        ('playwright', 'Playwright'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='knowledge_base')
    row_id = models.CharField(max_length=50)
    content = models.TextField(blank=True, default='')
    column_hashes = models.JSONField(default=dict)
    embedding = VectorField(dimensions=768, null=True, blank=True)
    image_url = models.TextField(blank=True, null=True)
    image_caption = models.TextField(blank=True, default='')
    image_embedding = VectorField(dimensions=768, null=True, blank=True)
    image_updated_at = models.DateTimeField(blank=True, null=True)
    image_source = models.CharField(max_length=20, choices=IMAGE_SOURCE_CHOICES, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            HnswIndex(
                name='vector_hnsw_idx',
                fields=['embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            ),
            HnswIndex(
                name='image_vector_hnsw_idx',
                fields=['image_embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            )
        ]

    def __str__(self):
        return f"{self.user.email}"


class RowImage(models.Model):
    """
    🖼️ Stores multiple images per row with embeddings and captions.
    Replaces single image_url field in SpreadsheetKnowledge.
    """
    IMAGE_SOURCE_CHOICES = [
        ('manual', 'Manual'),
        ('auto_search', 'Auto Search'),
        ('playwright', 'Playwright'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='row_images')
    row_id = models.CharField(max_length=50, db_index=True)  # Format: "sheet_{id}_row_{index}"
    
    # Image storage and metadata
    image_url = models.TextField()  # URL on MinIO/S3 or external URL
    image_filename = models.CharField(max_length=255, blank=True, default='')
    image_caption = models.TextField(blank=True, default='')
    image_embedding = VectorField(dimensions=768, null=True, blank=True)
    caption_embedding = VectorField(dimensions=768, null=True, blank=True)
    source_url = models.TextField(blank=True, default='')
    
    # Metadata
    source = models.CharField(max_length=20, choices=IMAGE_SOURCE_CHOICES, default='manual')
    is_primary = models.BooleanField(default=False, help_text="Primary image for row thumbnail")
    position = models.IntegerField(default=0, help_text="Order index for display")
    
    # Tracking
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
 
    class Meta:
        ordering = ['position', 'created_at']
        indexes = [
            HnswIndex(
                name='row_image_embedding_hnsw_idx',
                fields=['image_embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            ),
            HnswIndex(
                name='row_image_caption_emb_hnsw_idx',
                fields=['caption_embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops']
            )
        ]
        unique_together = [['user', 'row_id', 'image_url']]

    def __str__(self):
        return f"RowImage-{self.row_id}: {self.image_filename or 'N/A'}"

    def save(self, *args, **kwargs):
        """Ensure only one primary image per row"""
        if self.is_primary:
            RowImage.objects.filter(user=self.user, row_id=self.row_id, is_primary=True).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


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
    tokens_count = models.IntegerField(default=0, help_text="Total tokens consumed by the document content")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if getattr(self, 'full_content', None):
            try:
                import tiktoken
                encoding = tiktoken.get_encoding('cl100k_base')
                
                # Some approximation if tiktoken throws issue or exact length
                if self.full_content.strip():
                    self.tokens_count = len(encoding.encode(self.full_content))
                else:
                    self.tokens_count = 0
            except Exception:
                # Fallback approximation
                self.tokens_count = len(self.full_content) // 4
        else:
            self.tokens_count = 0
            
        super().save(*args, **kwargs)

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


class RowSimilarity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='row_similarities')
    source_row_id = models.CharField(max_length=50, db_index=True)
    target_row_id = models.CharField(max_length=50, db_index=True)
    distance = models.FloatField()

    class Meta:
        unique_together = [['user', 'source_row_id', 'target_row_id']]

    def __str__(self):
        return f"{self.source_row_id} -> {self.target_row_id} ({self.distance:.4f})"
