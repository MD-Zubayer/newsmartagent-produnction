from rest_framework import serializers
from .models import Extension, ExtensionAssignment, ExtensionExecutionLog, ExtensionVersion


class ExtensionVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtensionVersion
        fields = "__all__"
        read_only_fields = ("created_by", "created_at", "updated_at")


class ExtensionSerializer(serializers.ModelSerializer):
    versions = ExtensionVersionSerializer(many=True, read_only=True)

    class Meta:
        model = Extension
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class ExtensionAssignmentSerializer(serializers.ModelSerializer):
    extension_key = serializers.CharField(source="extension.key", read_only=True)
    version_name = serializers.CharField(source="version.version", read_only=True)

    class Meta:
        model = ExtensionAssignment
        fields = "__all__"
        read_only_fields = ("created_at", "updated_at")


class ExtensionExecutionLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtensionExecutionLog
        fields = "__all__"

