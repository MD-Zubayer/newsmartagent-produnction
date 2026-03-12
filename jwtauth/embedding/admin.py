from django.contrib import admin
from .models import DocumentKnowledge

@admin.register(DocumentKnowledge)
class DocumentKnowledgeAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'doc_title', 'chunk_index', 'created_at', 'get_embedding_preview')
    list_filter = ('user', 'created_at', 'doc_title')
    search_fields = ('doc_title', 'content', 'user__email')
    readonly_fields = ('created_at', 'embedding_full_view')

    def get_embedding_preview(self, obj):
        """ভেক্টরের প্রথম কয়েকটা ভ্যালু প্রিভিউ হিসেবে দেখাবে"""
        # এরর ফিক্স: সরাসরি 'if obj.embedding' না লিখে 'is not None' চেক করুন
        if obj.embedding is not None:
            try:
                # যদি এটি NumPy array হয় তবে সেটিকে লিস্টে রূপান্তর করে প্রিভিউ নিন
                emb_list = list(obj.embedding)
                return f"{emb_list[:5]}..."
            except:
                return "Error displaying vector"
        return "No Vector"
    get_embedding_preview.short_description = "Embedding Preview"

    def embedding_full_view(self, obj):
        """ডিটেইল ভিউতে পুরো ভেক্টর ডাটা দেখাবে"""
        if obj.embedding is not None:
            return list(obj.embedding)
        return "No Vector"
    embedding_full_view.short_description = "Full Vector Data"

    fieldsets = (
        ('Basic Information', {
            'fields': ('user', 'doc_title', 'chunk_index')
        }),
        ('Content', {
            'fields': ('content',)
        }),
        ('Vector Data', {
            'fields': ('embedding_full_view', 'created_at'),
        }),
    )