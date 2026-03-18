from rest_framework import serializers
from .models import AgentSettings

class AgentSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSettings
        fields = ['is_order_enable']
