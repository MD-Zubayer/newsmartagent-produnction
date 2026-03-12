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
        # Fetch all unique document titles for the user
        docs = DocumentKnowledge.objects.filter(user=request.user).values('doc_title').distinct()
        titles = [doc['doc_title'] for doc in docs]
        return Response({"documents": titles}, status=status.HTTP_200_OK)

    def delete(self, request, *args, **kwargs):
        # Delete specific document by title
        doc_title = request.data.get('doc_title')
        if not doc_title:
            return Response({"error": "doc_title is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        deleted, _ = DocumentKnowledge.objects.filter(user=request.user, doc_title=doc_title).delete()
        if deleted > 0:
            return Response({"message": f"Deleted document '{doc_title}'."}, status=status.HTTP_200_OK)
        return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
