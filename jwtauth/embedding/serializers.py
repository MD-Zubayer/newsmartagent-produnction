from rest_framework import serializers
from .models import Document, DocumentKnowledge

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'user', 'title', 'scope', 'agent', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class DocumentDetailSerializer(serializers.ModelSerializer):

    
    class Meta:
        model = Document
        fields = ['id', 'user', 'title', 'scope', 'agent', 'full_content', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
        
    def get_full_text(self, obj):
        chunks = obj.chunks.all().order_by('chunk_index')
        return " ".join([c.content for c in chunks])
