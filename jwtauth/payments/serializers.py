from rest_framework import serializers
from users.models import User, Subscription, Offer, Profile, Payment
from rest_framework_simplejwt.exceptions import InvalidToken




class PaymentSerializer(serializers.ModelSerializer):


    class Meta:
        model = Payment
        fields = ['id', 'offer', 'amount', 'status', 'transaction_id', 'created_at']
        
        read_only_fields = ['id', 'amount', 'status', 'profile']

