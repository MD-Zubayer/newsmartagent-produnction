from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Spreadsheet
from .serializers import SpreadsheetSerializer
from embedding.utils import sync_spreadsheet_to_knowledge
class SpreadsheetListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        sheets = Spreadsheet.objects.filter(user=request.user)
        serializer = SpreadsheetSerializer(sheets, many=True)
        return Response(serializer.data)

    def post(self, request):
        # রিকোয়েস্ট ডাটার সাথে ইউজারকে যুক্ত করে সেভ করা
        serializer = SpreadsheetSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user) # ইউজার অটোমেটিক সেভ হবে
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SpreadsheetDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk, user):
        try:
            return Spreadsheet.objects.get(pk=pk, user=user)
        except Spreadsheet.DoesNotExist:
            return None

    def get(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = SpreadsheetSerializer(sheet)
        return Response(serializer.data)

    def put(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # partial=True দেওয়া আছে যাতে শুধু পরিবর্তিত ডাটা সেভ করা যায় (যেমন: শুধু data বা শুধু title)
        serializer = SpreadsheetSerializer(sheet, data=request.data, partial=True)
        if serializer.is_valid():
           saved_sheet = serializer.save()

            # ২. যদি রিকোয়েস্টে 'data' (গ্রিড ডাটা) থাকে, তবেই এমবেডিং আপডেট হবে
           if 'data' in request.data:



                print("--- Triggering Embedding Sync ---")
                updated_rows = sync_spreadsheet_to_knowledge(request.user, saved_sheet.data)
                print(f"Total {updated_rows} rows updated in Knowledge Base.")

           return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        sheet.delete() # আগে ডিলিট হবে, তারপর রেসপন্স
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_204_NO_CONTENT)