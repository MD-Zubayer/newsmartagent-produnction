from rest_framework import serializers

from .models import District, Entry


def normalize_digits(value):
    translation = str.maketrans("০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩", "01234567890123456789")
    return str(value or "").translate(translation).strip()


def to_arabic_digits(value):
    return normalize_digits(value).translate(str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩"))


def normalize_blood_group(value):
    value = str(value or "").strip().upper().replace(" ", "")
    return {"+B": "B+", "+A": "A+", "+AB": "AB+", "+O": "O+", "-B": "B-", "-A": "A-", "-AB": "AB-", "-O": "O-"}.get(value, value)


class DistrictSerializer(serializers.ModelSerializer):
    display_name = serializers.ReadOnlyField()
    arabic_name = serializers.ReadOnlyField()

    class Meta:
        model = District
        fields = ["id", "name", "name_bn", "display_name", "arabic_name"]


class EntrySerializer(serializers.ModelSerializer):
    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.entry_language == "ar":
            for field in ("mobile_number", "education_period"):
                if data.get(field):
                    data[field] = to_arabic_digits(data[field])
        return data

    district_name = serializers.SerializerMethodField()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        entry_language = attrs.get("entry_language") or getattr(self.instance, "entry_language", None)
        if entry_language == "ar":
            for field in ("mobile_number", "education_period"):
                if field in attrs and attrs[field]:
                    attrs[field] = to_arabic_digits(attrs[field])
        return attrs

    def get_district_name(self, obj):
        if obj.entry_language == "ar":
            return obj.district.name
        return obj.district.display_name

    def validate_dakhila_no(self, value):
        return normalize_digits(value)

    def validate_mobile_number(self, value):
        return normalize_digits(value)

    def validate_blood_group(self, value):
        value = normalize_blood_group(value)
        if value and value not in {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}:
            raise serializers.ValidationError("রক্তের গ্রুপ সঠিকভাবে নির্বাচন করুন, যেমন B+")
        return value

    def validate_education_period(self, value):
        value = normalize_digits(value)
        if value and not value.isdigit():
            raise serializers.ValidationError("শিক্ষাকাল শুধু কত বছর পড়েছে সেই সংখ্যা দিন, যেমন 3; সাল বা date-range নয়")
        return value

    class Meta:
        model = Entry
        fields = [
            "id", "entry_language", "dakhila_no", "name", "father_name", "village", "thana",
            "district", "district_name", "mobile_number", "blood_group",
            "education_period", "correction_status", "original_data", "corrected_data", "correction_notes", "corrected_at", "created_at", "updated_at",
        ]
