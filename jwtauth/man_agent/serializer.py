from rest_framework import serializers
from man_agent.models import ManAgentConfig
from django.contrib.auth import get_user_model

User = get_user_model()

class ManAgentConfigSerializer(serializers.ModelSerializer):
    # প্রোফাইল থেকে কিছু তথ্য দেখানোর জন্য (ঐচ্ছিক)
    agent_name = serializers.CharField(source='man_agent.name', read_only=True)
    created_at = serializers.DateTimeField(format="%Y-%m-%d %H:%M:%S", read_only=True)

    class Meta:
        model = ManAgentConfig
        fields = ['id', 'otp_key', 'is_active', 'created_at', 'agent_name']
        read_only_fields = ['id', 'created_at']
   
   
class ReferredUserSerializer(serializers.ModelSerializer):
    # 'date_joined' সাধারণত User মডেলের ডিফল্ট ফিল্ড
    joined_at = serializers.DateTimeField(source='date_joined', read_only=True)
    is_active = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'name', 'is_active', 'joined_at']

    def get_is_active(self, obj):
        try:
            # profile থেকে সব সাবস্ক্রিপশন নিয়ে সবশেষটি (latest) চেক করা হচ্ছে
            # .first() ই কেবল লেটেস্ট রেকর্ডটি দেবে কারণ আমরা '-id' দিয়ে সর্ট করেছি
            latest_subscription = obj.profile.subscription_set.all().order_by('-id').first()
            
            if latest_subscription:
                return latest_subscription.is_active
            return False
        except Exception:
            return False