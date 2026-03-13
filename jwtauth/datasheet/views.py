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
                    updated_rows = sync_spreadsheet_to_knowledge(
                    user=request.user, 
                    grid_data=clean_data, # আপনার ফিল্টার করা ডাটা
                    sheet_id=saved_sheet.id # এখানে ডিফল্ট আইডি পাস হচ্ছে
                )
                    print(f"Total {updated_rows} valid rows updated in Knowledge Base.")
                else:
                    # যদি কোনো ডেটা না থাকে, তবে নলেজ বেস থেকে ওই ইউজারের ডাটা ক্লিয়ার করে দেওয়া ভালো
                    from embedding.models import SpreadsheetKnowledge
                    SpreadsheetKnowledge.objects.filter(user=request.user, spreadsheet_id=saved_sheet.id).delete()
                    print(f"Knowledge base cleared for Sheet {saved_sheet.id}.")
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        sheet = self.get_object(pk, request.user)
        if not sheet:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # 🔥 FIX: শুধু এই নির্দিষ্ট স্প্রেডশিটের নলেজ ডিলিট করুন
        from embedding.models import SpreadsheetKnowledge
        SpreadsheetKnowledge.objects.filter(user=request.user, spreadsheet_id=pk).delete()
        
        sheet.delete()
        return Response({'message': 'Deleted successfully'}, status=status.HTTP_204_NO_CONTENT)