from rest_framework import serializers
from .models import Document, DocumentKnowledge

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'user', 'title', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

class DocumentDetailSerializer(serializers.ModelSerializer):
    full_text = serializers.SerializerMethodField()
    
    class Meta:
        model = Document
        fields = ['id', 'user', 'title', 'full_text', 'created_at', 'updated_at']
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
        
    def get_full_text(self, obj):
        chunks = obj.chunks.all().order_by('chunk_index')
        return " ".join([c.content for c in chunks])
