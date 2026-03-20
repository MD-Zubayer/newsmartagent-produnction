from rest_framework import serializers
from aiAgent.models import AgentAI, TokenUsageLog, AIProviderModel, Contact
from chat.models import Message


class AIProviderModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIProviderModel # আপনার নতুন তৈরি করা মডেল
        fields = ['id', 'name', 'model_id', 'provider']



class AgentAIListSerializer(serializers.ModelSerializer):
    """
    List & details
    
    """
    selected_model_detail = AIProviderModelSerializer(source='selected_model', read_only=True)
    class Meta:
        model = AgentAI
        fields = [
            'id',
            'name',
            'platform',
            'page_id',
            'webhook_secret',
            'system_prompt',
            'greeting_message',
            'ai_model',
            'selected_model', 'selected_model_detail',
            'token_expires_at',
            'is_active',
            'created_at',
            'access_token',
            'is_special_agent',
            'special_agent_status'
        ]
        read_only_fields = ['id', 'created_at', 'token_expires_at', 'special_agent_status']
 





class AgentAISerializer(serializers.ModelSerializer):
    """
    create & update AgentAI model
    """
    class Meta:
        model = AgentAI
        fields = [
            'id',
            'name',
            'platform',
            'page_id',
            'access_token',
            'webhook_secret',
            'system_prompt',
            'greeting_message',
            'ai_model',
            'selected_model',
            'token_expires_at',
            'is_active',
            'is_special_agent',
            'special_agent_status'
        ]
        extra_kwargs = {
            'access_token': {'write_only': True},     # শুধু write করা যাবে, response-এ দেখাবে না
            'webhook_secret': {'write_only': True},
            'token_expires_at': {'required': False},
            'selected_model': {'required': False, 'allow_null': True},
            'special_agent_status': {'read_only': True},
        }

    def validate_platform(self, value):
        """
        Ensure platform is lowercase
        """
        if value:
            return value.lower()
        return value

    def create(self, validated_data):
        user = self.context['request'].user
        return AgentAI.objects.create(user=user, **validated_data)



class TokenUsageAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TokenUsageLog
        fields = '__all__'


class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = [
            'id', 'agent', 'identifier', 'name', 'push_name', 
            'is_auto_reply_enabled', 'platform', 'created_at', 'updated_at',
            'custom_prompt', 'custom_instructions'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'platform', 'sent_at', 'tokens_used']