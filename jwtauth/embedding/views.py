from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .utils import process_document_text
from .models import DocumentKnowledge

class DocumentUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        text = request.data.get('text')
        doc_title = request.data.get('doc_title', 'Generic Document')

        if not text:
            return Response({"error": "Text content is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            chunks_saved = process_document_text(request.user, text, doc_title)
            return Response({
                "message": "Document processed and knowledge base updated successfully.",
                "chunks_saved": chunks_saved
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request, *args, **kwargs):
        # query_params থেকে doc_title চেক করা হচ্ছে
        doc_title = request.query_params.get('doc_title')
        
        if doc_title:
            # নির্দিষ্ট ডকুমেন্টের সব chunks সিরিয়ালি নিয়ে আসা
            chunks = DocumentKnowledge.objects.filter(
                user=request.user, 
                doc_title=doc_title
            ).order_by('chunk_index')
            
            if not chunks.exists():
                return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
            
            # সব কন্টেন্ট একসাথে জোড়া দেওয়া
            full_text = " ".join([c.content for c in chunks])
            return Response({
                "doc_title": doc_title,
                "text": full_text
            }, status=status.HTTP_200_OK)

        # যদি টাইটেল না থাকে তবে আগের মতো শুধু লিস্ট পাঠানো
        docs = DocumentKnowledge.objects.filter(user=request.user).values('doc_title').distinct()
        titles = [doc['doc_title'] for doc in docs]
        return Response({"documents": titles}, status=status.HTTP_200_OK)

    def put(self, request, *args, **kwargs):
        """
        ডকুমেন্ট আপডেট করার জন্য। 
        পুরানো ভেক্টরগুলো মুছে নতুন করে চাঙ্ক এবং এমবেডিং তৈরি করবে।
        """
        text = request.data.get('text')
        doc_title = request.data.get('doc_title')

        if not text or not doc_title:
            return Response({"error": "Title and text are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # ১. পুরানো ডাটা মুছে ফেলা (যেহেতু টেক্সট চেঞ্জ হলে ভেক্টর বদলে যায়)
            DocumentKnowledge.objects.filter(user=request.user, doc_title=doc_title).delete()
            
            # ২. নতুন টেক্সট প্রসেস করা
            chunks_saved = process_document_text(request.user, text, doc_title)
            
            return Response({
                "message": "Document updated and re-indexed successfully.",
                "chunks_saved": chunks_saved
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    def delete(self, request, *args, **kwargs):
        # Delete specific document by title
        doc_title = request.data.get('doc_title')
        if not doc_title:
            return Response({"error": "doc_title is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        deleted, _ = DocumentKnowledge.objects.filter(user=request.user, doc_title=doc_title).delete()
        if deleted > 0:
            return Response({"message": f"Deleted document '{doc_title}'."}, status=status.HTTP_200_OK)
        return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
