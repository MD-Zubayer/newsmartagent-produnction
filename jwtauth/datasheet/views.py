from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .models import Spreadsheet
from .serializers import SpreadsheetSerializer
from embedding.utils import sync_spreadsheet_to_knowledge
from .tasks import run_auto_image_search_task, sync_spreadsheet_to_knowledge_task
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.urls import reverse
from embedding.utils import get_gemini_image_embedding
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
        
        serializer = SpreadsheetSerializer(sheet, data=request.data, partial=True)
        if serializer.is_valid():
            saved_sheet = serializer.save()

            # ২. যদি রিকোয়েস্টে 'data' থাকে, তবে ক্লিনিং লজিক চলবে
            if 'data' in request.data:
                print("--- Triggering Smart Embedding Sync ---")
                
                raw_data = saved_sheet.data  # ডিকশনারি ফর্মেট: {'0-0': 'Head', '1-0': 'Value'}
                clean_data = {}
                rows_with_content = set()

                # ধাপ ১: কোন কোন রো-তে আসল তথ্য (Value) আছে তা খুঁজে বের করা
                for key, value in raw_data.items():
                    try:
                        r_idx = key.split('-')[0]
                        # রো যদি ০ না হয় (হেডার বাদে) এবং ভ্যালু যদি খালি না থাকে
                        if r_idx != "0" and str(value).strip():
                            rows_with_content.add(r_idx)
                    except (IndexError, AttributeError):
                        continue

                # ধাপ ২: হেডার রো (Row 0) এবং শুধু তথ্য থাকা রো গুলোকে আলাদা করা
                for key, value in raw_data.items():
                    r_idx = key.split('-')[0]
                    if r_idx == "0" or r_idx in rows_with_content:
                        clean_data[key] = value

                # ধাপ ৩: যদি কোনো ডেটা থাকে (হেডার বাদে), তবেই সিঙ্ক কল করা
                if rows_with_content:
                    if len(rows_with_content) > 40:
                        sync_spreadsheet_to_knowledge_task.delay(request.user.id, clean_data, saved_sheet.id)
                        print(f"Large sheet detected. Scheduled background sync task for Sheet {saved_sheet.id}.")
                    else:
                        updated_rows = sync_spreadsheet_to_knowledge(
                            user=request.user,
                            grid_data=clean_data,
                            sheet_id=saved_sheet.id
                        )
                        print(f"Total {updated_rows} valid rows updated in Knowledge Base.")
                    if saved_sheet.auto_image_search:
                        run_auto_image_search_task.delay(saved_sheet.id)
                        print(f"Auto image search scheduled for Sheet {saved_sheet.id}.")
                else:
                    # যদি কোনো ডেটা না থাকে, তবে নলেজ বেস থেকে ওই ইউজারের ডাটা ক্লিয়ার করে দেওয়া ভালো
                    from embedding.models import SpreadsheetKnowledge
                    SpreadsheetKnowledge.objects.filter(user=request.user, row_id__startswith=f"sheet_{saved_sheet.id}_").delete()
                    print(f"Knowledge base cleared for Sheet {saved_sheet.id}.")
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # 🔥 FIX: শুধু এই নির্দিষ্ট স্প্রেডশিটের নলেজ ডিলিট করুন
        from embedding.models import SpreadsheetKnowledge
        SpreadsheetKnowledge.objects.filter(user=request.user, row_id__startswith=f"sheet_{pk}_").delete()
        
        sheet.delete()
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_204_NO_CONTENT)


class RowImageUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Upload an image file for a specific row.

        Expected form-data: file (image), row_index (string or int)
        """
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Sheet not found'}, status=status.HTTP_404_NOT_FOUND)

        file_obj = request.FILES.get('file')
        row_index = request.data.get('row_index')
        if not row_index:
            return Response({'error': 'row_index is required'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj:
            return Response({'error': 'file is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Save file to default storage under a predictable path
        filename = f'user_{request.user.id}/sheet_{sheet.id}/row_{row_index}/{file_obj.name}'
        saved_path = default_storage.save(filename, ContentFile(file_obj.read()))
        try:
            url = default_storage.url(saved_path)
        except Exception:
            url = saved_path

        # Update SpreadsheetKnowledge for the row
        from embedding.models import SpreadsheetKnowledge
        row_unique_id = f"sheet_{sheet.id}_row_{row_index}"
        obj, created = SpreadsheetKnowledge.objects.get_or_create(
            user=request.user,
            row_id=row_unique_id,
            defaults={'column_hashes': {}, 'content': ''}
        )
        obj.image_url = url
        image_vector = get_gemini_image_embedding(url)
        if image_vector:
            obj.image_embedding = image_vector
            obj.image_source = 'manual'
            from django.utils import timezone
            obj.image_updated_at = timezone.now()
        obj.save()

        # Return the saved image URL so frontend can update column A
        return Response({'image_url': url}, status=status.HTTP_201_CREATED)