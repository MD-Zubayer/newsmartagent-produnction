from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from .utils import process_document_text
from .models import DocumentKnowledge
from django.db import transaction
from .models import Document, DocumentKnowledge
from .serializers import DocumentSerializer, DocumentDetailSerializer

class DocumentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        documents = Document.objects.filter(user=request.user)
        serializer = DocumentSerializer(documents, many=True)
        return Response({"documents": serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        text = request.data.get('text')
        title = request.data.get('doc_title') or 'Untitled Document'

        if not text:
            return Response({"error": "Text content is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic(): # ট্রানজ্যাকশন শুরু
                document = Document.objects.create(user=request.user, title=title)
                chunks_saved = process_document_text(request.user, text, document)
                
                return Response({
                    "message": "Document created and processed successfully.",
                    "id": document.id,
                    "title": document.title,
                    "chunks_saved": chunks_saved
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            print(f"Post Error: {str(e)}") # ডকার লগ চেক করার জন্য
            return Response({"error": "Failed to create document."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DocumentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Document.objects.get(pk=pk, user=user)
        except Document.DoesNotExist:
            return None

    def get(self, request, pk):
        document = self.get_object(pk, request.user)
        if not document:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
            
        serializer = DocumentDetailSerializer(document)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        document = self.get_object(pk, request.user)
        if not document:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        text = request.data.get('text')
        title = request.data.get('doc_title')

        if title:
            document.title = title
            document.save()

        if text:
            try:
                chunks_saved = process_document_text(request.user, text, document)
                return Response({
                    "message": "Document updated and re-indexed successfully.",
                    "chunks_saved": chunks_saved
                }, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response({"message": "Document title updated."}, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        document = self.get_object(pk, request.user)
        if not document:
            return Response({"error": "Document not found."}, status=status.HTTP_404_NOT_FOUND)
            
        document.delete()
        return Response({"message": "Document deleted successfully."}, status=status.HTTP_200_OK)
