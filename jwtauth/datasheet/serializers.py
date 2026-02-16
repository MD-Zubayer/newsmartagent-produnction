from rest_framework import serializers
from datasheet.models import Spreadsheet




class SpreadsheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spreadsheet
        fields = '__all__'
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']
        