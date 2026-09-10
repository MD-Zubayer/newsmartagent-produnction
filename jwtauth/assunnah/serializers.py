from rest_framework import serializers

from .models import District, Entry


class DistrictSerializer(serializers.ModelSerializer):
    class Meta:
        model = District
        fields = ["id", "name"]


class EntrySerializer(serializers.ModelSerializer):
    district_name = serializers.CharField(source="district.name", read_only=True)

    class Meta:
        model = Entry
        fields = [
            "id", "entry_language", "dakhila_no", "name", "father_name", "village", "thana",
            "district", "district_name", "mobile_number", "blood_group",
            "education_period", "created_at", "updated_at",
        ]
