from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import Collection, District, Entry
from .serializers import EntrySerializer, normalize_digits, normalize_blood_group
from .views import find_arabic_source, sort_entries_like_ui


class DigitAndBloodGroupNormalizationTests(TestCase):
    def test_normalize_digits(self):
        self.assertEqual(normalize_digits("٠١٧١٢٣٤٥٦٧٨"), "01712345678")
        self.assertEqual(normalize_digits("০১৭১২৩৪৫৬৭৮"), "01712345678")
        self.assertEqual(normalize_digits("01712345678"), "01712345678")
        self.assertEqual(normalize_digits("٣"), "3")
        self.assertEqual(normalize_digits("৩"), "3")
        self.assertEqual(normalize_digits("3"), "3")

    def test_normalize_blood_group(self):
        self.assertEqual(normalize_blood_group("+B"), "B+")
        self.assertEqual(normalize_blood_group("-AB"), "AB-")
        self.assertEqual(normalize_blood_group("b+"), "B+")
        self.assertEqual(normalize_blood_group("A+"), "A+")


class AssunnahEntryValidationAndLookupTests(TestCase):
    def setUp(self):
        self.collection = Collection.objects.create(expires_at=timezone.now() + timedelta(days=1))
        self.district_ar = District.objects.create(collection=self.collection, name="داكا")
        self.district_bn = District.objects.create(collection=self.collection, name="চট্টগ্রাম", name_bn="চট্টগ্রাম")

    def test_district_display_name_arabic_mapping(self):
        self.assertEqual(self.district_ar.display_name, "ঢাকা")
        self.assertEqual(self.district_bn.display_name, "চট্টগ্রাম")

    def test_entry_serializer_district_name_by_language(self):
        ar_entry = Entry.objects.create(
            collection=self.collection,
            entry_language="ar",
            dakhila_no="101",
            name="اسم",
            father_name="أب",
            village="قرية",
            thana="مركز",
            district=self.district_ar,
            mobile_number="01712345678",
        )
        bn_entry = Entry.objects.create(
            collection=self.collection,
            entry_language="bn",
            dakhila_no="102",
            name="নাম",
            father_name="পিতা",
            village="গ্রাম",
            thana="থানা",
            district=self.district_ar,
            mobile_number="01712345678",
        )
        self.assertEqual(EntrySerializer(ar_entry).data["district_name"], "داكا")
        self.assertEqual(EntrySerializer(bn_entry).data["district_name"], "ঢাকা")

    def test_entry_serializer_normalizes_digits_and_validates_blood_group(self):
        data = {
            "entry_language": "bn",
            "dakhila_no": "১০৪৪৪",
            "name": "আব্দুল্লাহ",
            "father_name": "আব্দুর রহমান",
            "village": "কাওনা",
            "thana": "মির্জাপুর",
            "district": self.district_ar.pk,
            "mobile_number": "٠١٧١٢٣٤٥٦٧٨",
            "blood_group": "+B",
            "education_period": "٣",
        }
        serializer = EntrySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        validated = serializer.validated_data
        self.assertEqual(validated["dakhila_no"], "10444")
        self.assertEqual(validated["mobile_number"], "01712345678")
        self.assertEqual(validated["blood_group"], "B+")
        self.assertEqual(validated["education_period"], "3")

    def test_arabic_entry_preserves_arabic_mobile_and_education_digits(self):
        data = {
            "entry_language": "ar",
            "dakhila_no": "10003",
            "name": "اسم",
            "father_name": "أب",
            "village": "قرية",
            "thana": "مركز",
            "district": self.district_ar.pk,
            "mobile_number": "٠١٧١٢٣٤٥٦٧٨",
            "education_period": "٣",
        }
        serializer = EntrySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["mobile_number"], "٠١٧١٢٣٤٥٦٧٨")
        self.assertEqual(serializer.validated_data["education_period"], "٣")

    def test_arabic_entry_representation_converts_legacy_english_digits(self):
        entry = Entry.objects.create(
            collection=self.collection,
            entry_language="ar",
            dakhila_no="10004",
            name="اسم",
            father_name="أب",
            village="قرية",
            thana="مركز",
            district=self.district_ar,
            mobile_number="01712345678",
            education_period="3",
        )
        data = EntrySerializer(entry).data
        self.assertEqual(data["mobile_number"], "٠١٧١٢٣٤٥٦٧٨")
        self.assertEqual(data["education_period"], "٣")

    def test_invalid_blood_group_raises_validation_error(self):
        data = {
            "entry_language": "bn",
            "dakhila_no": "10001",
            "name": "Test",
            "father_name": "Test",
            "village": "Village",
            "thana": "Thana",
            "district": self.district_ar.pk,
            "mobile_number": "01700000000",
            "blood_group": "INVALID_BG",
        }
        serializer = EntrySerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("blood_group", serializer.errors)

    def test_missing_optional_fields_allowed(self):
        data = {
            "entry_language": "bn",
            "dakhila_no": "10002",
            "name": "Test",
            "father_name": "Test",
            "village": "Village",
            "thana": "Thana",
            "district": self.district_ar.pk,
            "mobile_number": "01700000000",
            "blood_group": "",
            "education_period": "",
        }
        serializer = EntrySerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_arabic_source_lookup_matches_and_returns_correct_district_and_mobile(self):
        arabic_entry = Entry.objects.create(
            collection=self.collection,
            entry_language="ar",
            dakhila_no="10444",
            name="اسم",
            father_name="أب",
            village="قرية",
            thana="مركز",
            district=self.district_ar,
            mobile_number="01712345678",
            blood_group="B+",
            education_period="3",
        )
        found = find_arabic_source(self.collection, "১০৪৪৪")
        self.assertIsNotNone(found)
        self.assertEqual(found.pk, arabic_entry.pk)
        self.assertEqual(found.mobile_number, "01712345678")
        self.assertEqual(found.district.display_name, "ঢাকা")

    def test_save_and_reload_persistence(self):
        entry = Entry.objects.create(
            collection=self.collection,
            entry_language="bn",
            dakhila_no="10444",
            name="আব্দুল্লাহ",
            father_name="আব্দুর রহমান",
            village="কাওনা",
            thana="মির্জাপুর",
            district=self.district_ar,
            mobile_number="01712345678",
            blood_group="B+",
            education_period="3",
        )
        reloaded = Entry.objects.get(pk=entry.pk)
        self.assertEqual(reloaded.dakhila_no, "10444")
        self.assertEqual(reloaded.mobile_number, "01712345678")
        self.assertEqual(reloaded.blood_group, "B+")
        self.assertEqual(reloaded.education_period, "3")

    def test_duplicate_dakhila_per_language_constraint(self):
        Entry.objects.create(
            collection=self.collection,
            entry_language="bn",
            dakhila_no="10444",
            name="Test 1",
            father_name="Father 1",
            village="Village 1",
            thana="Thana 1",
            district=self.district_ar,
            mobile_number="01700000000",
        )
        with self.assertRaises(Exception):
            Entry.objects.create(
                collection=self.collection,
                entry_language="bn",
                dakhila_no="10444",
                name="Test 2",
                father_name="Father 2",
                village="Village 2",
                thana="Thana 2",
                district=self.district_ar,
                mobile_number="01700000001",
            )


class AssunnahExportOrderingTests(TestCase):
    def setUp(self):
        self.collection = Collection.objects.create(expires_at=timezone.now() + timedelta(days=1))
        self.dhaka = District.objects.create(collection=self.collection, name="داكا")
        self.chattogram = District.objects.create(collection=self.collection, name="চট্টগ্রাম", name_bn="চট্টগ্রাম")

    def make_entry(self, district, dakhila_no, language="bn"):
        return Entry.objects.create(
            collection=self.collection,
            entry_language=language,
            dakhila_no=str(dakhila_no),
            name="নাম" if language == "bn" else "اسم",
            father_name="পিতা" if language == "bn" else "أب",
            village="গ্রাম" if language == "bn" else "قرية",
            thana="থানা" if language == "bn" else "مركز",
            district=district,
            mobile_number="01700000000",
        )

    def test_export_order_matches_ui_district_frequency(self):
        first = self.make_entry(self.chattogram, 2)
        self.make_entry(self.dhaka, 1)
        self.make_entry(self.dhaka, 3)

        ordered = sort_entries_like_ui(
            self.collection.entries.select_related("district").filter(entry_language="bn"),
            language="bn",
            count_entries=self.collection.entries.all(),
        )

        self.assertEqual(
            [entry.pk for entry in ordered],
            [
                self.collection.entries.get(dakhila_no="1").pk,
                self.collection.entries.get(dakhila_no="3").pk,
                first.pk,
            ],
        )
