from datetime import timedelta
from io import BytesIO

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from django.core import signing
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .auth import COOKIE_NAME, active_collection, password_is_valid
from .models import Collection, District, Entry
from .serializers import DistrictSerializer, EntrySerializer


class PasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not password_is_valid(request.data.get("password")):
            return Response({"detail": "ভুল password"}, status=status.HTTP_401_UNAUTHORIZED)
        collection = Collection.objects.filter(expires_at__gt=timezone.now()).order_by("-created_at").first()
        if not collection:
            collection = Collection.objects.create(expires_at=timezone.now() + timedelta(days=60))
        token = signing.dumps({"collection_id": collection.pk}, salt="as-sunnah-access")
        response = Response({"expires_at": collection.expires_at, "authenticated": True})
        response.set_cookie(COOKIE_NAME, token, max_age=60 * 60 * 24 * 60, httponly=True,
                            secure=request.is_secure(), samesite="Lax", path="/")
        return response


class BaseView(APIView):
    permission_classes = [AllowAny]

    def collection(self, request):
        return active_collection(request)


class StateView(BaseView):
    def get(self, request):
        collection = self.collection(request)
        return Response({"authenticated": True, "expires_at": collection.expires_at,
                         "entry_count": collection.entries.count()})


class DistrictView(BaseView):
    def get(self, request):
        collection = self.collection(request)
        return Response(DistrictSerializer(collection.districts.all(), many=True).data)

    def post(self, request):
        collection = self.collection(request)
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"detail": "জেলার নাম দিন"}, status=400)
        district, _ = District.objects.get_or_create(collection=collection, name=name)
        return Response(DistrictSerializer(district).data, status=status.HTTP_201_CREATED)


class EntryView(BaseView):
    def get(self, request):
        collection = self.collection(request)
        entries = collection.entries.select_related("district").all()
        district = request.query_params.get("district")
        search = request.query_params.get("search", "").strip()
        if district:
            entries = entries.filter(district_id=district)
        if search:
            from django.db.models import Q
            entries = entries.filter(Q(name__icontains=search) | Q(dakhila_no__icontains=search) |
                                     Q(mobile_number__icontains=search))
        return Response(EntrySerializer(entries, many=True).data)

    def post(self, request):
        collection = self.collection(request)
        serializer = EntrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        district = District.objects.filter(pk=serializer.validated_data["district"].pk,
                                            collection=collection).first()
        if not district:
            return Response({"detail": "Invalid district"}, status=400)
        entry = serializer.save(collection=collection)
        return Response(EntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class BulkEntryView(BaseView):
    def post(self, request):
        collection = self.collection(request)
        rows = request.data if isinstance(request.data, list) else request.data.get("entries", [])
        if not rows:
            return Response({"detail": "কমপক্ষে একটি entry দিন"}, status=400)
        serializer = EntrySerializer(data=rows, many=True)
        serializer.is_valid(raise_exception=True)
        district_ids = {item["district"].pk for item in serializer.validated_data}
        valid_districts = set(collection.districts.filter(pk__in=district_ids).values_list("pk", flat=True))
        if district_ids != valid_districts:
            return Response({"detail": "এক বা একাধিক district সঠিক নয়"}, status=400)
        with transaction.atomic():
            entries = [Entry(collection=collection, **item) for item in serializer.validated_data]
            Entry.objects.bulk_create(entries)
        return Response(EntrySerializer(entries, many=True).data, status=status.HTTP_201_CREATED)


class EntryDetailView(BaseView):
    def get_object(self, request, pk):
        collection = self.collection(request)
        return Entry.objects.get(pk=pk, collection=collection)

    def patch(self, request, pk):
        entry = self.get_object(request, pk)
        serializer = EntrySerializer(entry, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "district" in serializer.validated_data and serializer.validated_data["district"].collection_id != entry.collection_id:
            return Response({"detail": "Invalid district"}, status=400)
        return Response(EntrySerializer(serializer.save()).data)

    def delete(self, request, pk):
        self.get_object(request, pk).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportView(BaseView):
    def get(self, request):
        collection = self.collection(request)
        from docx import Document
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml import OxmlElement
        document = Document()
        language = request.query_params.get("language")
        entries_query = collection.entries.select_related("district").all()
        if language in {"ar", "bn"}:
            entries_query = entries_query.filter(entry_language=language)
        entries = list(entries_query)
        entries.sort(key=lambda entry: (entry.district.name, int(entry.dakhila_no), entry.id))
        bangla_digits = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
        for serial, entry in enumerate(entries, start=1):
            serial_text = str(serial).translate(bangla_digits)
            lines = [
                f"{serial_text}। নাম: {entry.name}",
                f"পিতা: {entry.father_name}",
                f"ঠিকানা: গ্রাম {entry.village}",
                f"থানা: {entry.thana}, জেলা: {entry.district.name}",
                f"মোবাইল: {entry.mobile_number}",
                f"রক্তের গ্রুপ: {entry.blood_group or '—'}",
                f"শিক্ষাকাল: {entry.education_period or '—'}",
            ]
            for line in lines:
                paragraph = document.add_paragraph(line)
                if entry.entry_language == "ar":
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                    paragraph_properties = paragraph._p.get_or_add_pPr()
                    bidi = OxmlElement("w:bidi")
                    bidi.set("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}val", "1")
                    paragraph_properties.append(bidi)
                else:
                    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
            document.add_paragraph()
        output = BytesIO()
        document.save(output)
        response = HttpResponse(output.getvalue(), content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        filename = "as-sunnah-arabic.docx" if language == "ar" else "as-sunnah-bangla.docx" if language == "bn" else "as-sunnah.docx"
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
