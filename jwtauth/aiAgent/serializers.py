from rest_framework import serializers
from aiAgent.models import AgentAI, TokenUsageLog, AIProviderModel, Contact, WidgetSettings
from chat.models import Message
import uuid


class AIProviderModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIProviderModel # আপনার নতুন তৈরি করা মডেল
        fields = ['id', 'name', 'model_id', 'provider']


class WidgetSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = WidgetSettings
        fields = [
            'primary_color', 'bubble_icon', 'bubble_icon_url', 'bubble_size', 'bubble_roundness', 'show_bubble_background',
            'whatsapp_number', 'messenger_link',
            'widget_position', 'header_title', 'header_subtitle', 'placeholder_text', 'is_enabled', 'allowed_domains'
        ]




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
    shared_cache_agent = serializers.PrimaryKeyRelatedField(source='get_settings.shared_cache_agent', read_only=True)
    widget_settings = WidgetSettingsSerializer(read_only=True)
    
    class Meta:
        model = AgentAI
        fields = [
            'id',
            'name',
            'platform',
            'page_id',
            'number',
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
            'special_agent_status',
            'shared_cache_agent',
            'widget_key',
            'widget_settings'
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
    shared_cache_agent = serializers.PrimaryKeyRelatedField(queryset=AgentAI.objects.all(), required=False, allow_null=True)
    widget_settings = WidgetSettingsSerializer(required=False)

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
            'special_agent_status',
            'shared_cache_agent',
            'widget_key',
            'widget_settings'
        ]
        extra_kwargs = {
            'access_token': {'write_only': True},     # শুধু write করা যাবে, response-এ দেখাবে না
            'webhook_secret': {'write_only': True},
            'token_expires_at': {'required': False},
            'selected_model': {'required': False, 'allow_null': True},
            'special_agent_status': {'read_only': True},
            'widget_key': {'read_only': True},
            'access_token': {'required': False, 'allow_null': True, 'write_only': True},
            'page_id': {'required': False, 'allow_null': True},
        }

    def validate_platform(self, value):
        """
        Ensure platform is lowercase
        """
        if value:
            return value.lower()
        return value

    def create(self, validated_data):
        # 'user' is injected via serializer.save(user=...) from perform_create, so it's already in validated_data.
        # Pulling it out separately and then passing via **validated_data would cause a duplicate argument error.
        history_limit = validated_data.pop('history_limit', 3)
        temperature = validated_data.pop('temperature', 0.7)
        max_tokens = validated_data.pop('max_tokens', 200)
        skip_history = validated_data.pop('skip_history', False)
        history_skip_keywords = validated_data.pop('history_skip_keywords', '')
        shared_cache_agent = validated_data.pop('shared_cache_agent', None)
        widget_settings_data = validated_data.pop('widget_settings', {})
        
        # Generate widget key if platform is web_widget
        if validated_data.get('platform') == 'web_widget':
            validated_data['widget_key'] = str(uuid.uuid4())
            # Ensure page_id is unique even if not provided
            if not validated_data.get('page_id'):
                validated_data['page_id'] = f"widget_{validated_data['widget_key']}"

        agent = AgentAI.objects.create(**validated_data)
        
        from settings.models import AgentAISettings
        AgentAISettings.objects.update_or_create(
            agent=agent,
            defaults={
                'history_limit': history_limit,
                'temperature': temperature,
                'max_tokens': max_tokens,
                'skip_history': skip_history,
                'history_skip_keywords': history_skip_keywords,
                'shared_cache_agent': shared_cache_agent
            }
        )
        
        # Create WidgetSettings if platform is web_widget
        from aiAgent.models import WidgetSettings
        WidgetSettings.objects.get_or_create(
            agent=agent,
            defaults=widget_settings_data
        )
        
        return agent

    def update(self, instance, validated_data):
        settings_data = {}
        for field in ['history_limit', 'temperature', 'max_tokens', 'skip_history', 'history_skip_keywords', 'shared_cache_agent']:
            if field in validated_data:
                settings_data[field] = validated_data.pop(field)
        
        widget_settings_data = validated_data.pop('widget_settings', None)
        
        # Generate widget key if changing to web_widget and doesn't exist
        if validated_data.get('platform') == 'web_widget' and not instance.widget_key:
            validated_data['widget_key'] = str(uuid.uuid4())
            if not validated_data.get('page_id') and not instance.page_id:
                validated_data['page_id'] = f"widget_{validated_data['widget_key']}"

        agent = super().update(instance, validated_data)
        
        if settings_data:
            from settings.models import AgentAISettings
            AgentAISettings.objects.update_or_create(
                agent=agent,
                defaults=settings_data
            )
        
        if widget_settings_data:
            from aiAgent.models import WidgetSettings
            # Ensure we update or create the settings for this agent
            WidgetSettings.objects.update_or_create(
                agent=agent,
                defaults=widget_settings_data
            )
            # Refresh the instance to ensure the nested serializer picks up the new values
            agent.refresh_from_db()
            
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