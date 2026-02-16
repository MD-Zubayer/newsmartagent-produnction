from rest_framework import serializers
from aiAgent.models import AgentAI, TokenUsageLog




class AgentAIListSerializer(serializers.ModelSerializer):
    """
    List & details
    
    """
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
            'temperature',
            'max_tokens',
            'token_expires_at',
            'is_active',
            'created_at',
            'access_token'
        ]
        read_only_fields = ['id', 'created_at', 'token_expires_at']
 







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
            'temperature',
            'max_tokens',
            'token_expires_at',
            'is_active',
        ]
        extra_kwargs = {
            'access_token': {'write_only': True},     # শুধু write করা যাবে, response-এ দেখাবে না
            'webhook_secret': {'write_only': True},
            'token_expires_at': {'required': False},
        }

       # set validation serializer 
       # 
    def validate_temperature(self, value):


        """
        Temperature must be between 0.0 and 2.0.
         """
        if not (0.0 <= value <= 2.0):

            raise serializers.ValidationError("Temperature must be between 0.0 and 2.0.")

        return value

    def validate_max_tokens(self, value):

        """
        Max tokens must be at least 1.
        """
        if value < 1:
             raise serializers.ValidationError("Max tokens must be at least 1.")
        return value

        def create(self, validated_data):
            user = self.context['request'].user
            return AgentAI.objects.create(user=user, **validated_data)



class TokenUsageAnalyticsSerializer(serializers.ModelSerializer):
    class Meta:
        model = TokenUsageLog
        fields = '__all__'