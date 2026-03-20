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
    history_limit = serializers.IntegerField(source='get_settings.history_limit', read_only=True)
    temperature = serializers.FloatField(source='get_settings.temperature', read_only=True)
    max_tokens = serializers.IntegerField(source='get_settings.max_tokens', read_only=True)
    skip_history = serializers.BooleanField(source='get_settings.skip_history', read_only=True)
    history_skip_keywords = serializers.CharField(source='get_settings.history_skip_keywords', read_only=True)
    
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
            'history_limit',
            'temperature',
            'max_tokens',
            'skip_history',
            'history_skip_keywords',
            'token_expires_at',
            'is_active',
            'created_at',
            'access_token',
            'is_special_agent',
            'special_agent_status'
        ]
        read_only_fields = ['id', 'created_at', 'token_expires_at', 'special_agent_status']
        extra_kwargs = {
            'access_token': {'write_only': True},
            'webhook_secret': {'write_only': True},
        }
 





class AgentAISerializer(serializers.ModelSerializer):
    """
    create & update AgentAI model
    """
    history_limit = serializers.IntegerField(required=False)
    temperature = serializers.FloatField(required=False)
    max_tokens = serializers.IntegerField(required=False)
    skip_history = serializers.BooleanField(required=False)
    history_skip_keywords = serializers.CharField(required=False, allow_blank=True, allow_null=True)

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
            'history_limit',
            'temperature',
            'max_tokens',
            'skip_history',
            'history_skip_keywords',
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
        
        history_limit = validated_data.pop('history_limit', 3)
        temperature = validated_data.pop('temperature', 0.7)
        max_tokens = validated_data.pop('max_tokens', 200)
        skip_history = validated_data.pop('skip_history', False)
        history_skip_keywords = validated_data.pop('history_skip_keywords', '')
        
        agent = AgentAI.objects.create(user=user, **validated_data)
        
        from settings.models import AgentAISettings
        AgentAISettings.objects.update_or_create(
            agent=agent,
            defaults={
                'history_limit': history_limit,
                'temperature': temperature,
                'max_tokens': max_tokens,
                'skip_history': skip_history,
                'history_skip_keywords': history_skip_keywords
            }
        )
        return agent

    def update(self, instance, validated_data):
        settings_data = {}
        for field in ['history_limit', 'temperature', 'max_tokens', 'skip_history', 'history_skip_keywords']:
            if field in validated_data:
                settings_data[field] = validated_data.pop(field)
                
        agent = super().update(instance, validated_data)
        
        if settings_data:
            from settings.models import AgentAISettings
            AgentAISettings.objects.update_or_create(
                agent=agent,
                defaults=settings_data
            )
        return agent



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