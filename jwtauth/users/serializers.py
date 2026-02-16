from rest_framework import serializers
from users.models import User, Subscription, Offer, Profile, Payment
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from users.models import CustomerOrder, OrderForm
from django.db import transaction
from man_agent.models import ManAgentConfig, ReferralRelation

#  Custom regresh token serializer
class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    refresh = None   # remove refresh from body

    def validate(self, attrs):
        # refresh token from cookie
        refresh_token = self.context['request'].COOKIES.get('refresh_token')
        if refresh_token:
            attrs['refresh'] = refresh_token
        else:
            raise InvalidToken('No refresh token in cookies')
        return super().validate(attrs)





class ProfileSerializer(serializers.ModelSerializer):
    user = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Profile
        fields = ["user", "id_type", "unique_id", "created_at", "updated_at", "word_balance"]


class UserSerializer(serializers.ModelSerializer[User]):
    profile = ProfileSerializer(read_only=True) # nested serializer

    man_agent_unique_id = serializers.CharField(write_only=True, required=False,allow_blank=True, allow_null=True)
    man_agent_otp_key = serializers.CharField(write_only=True, required=False, allow_blank=True, allow_null=True)
    
    
    class Meta:
        model = User
        fields = [
            "id",
            # "url",
            "email",
            "name",
            "phone_number",
            "division",
            "district",
            "upazila",
            "gender",
            "id_type",
            # "word_balance", 
            "created_by",
            "created_at",
            "password",
            "profile",#nested
            'man_agent_unique_id',
            'man_agent_otp_key',
            
        ]



        extra_kwargs = {
            # "url": {"view_name": "user-detail", "lookup_field": "id"},
            # "email": {"read_only": True},
            "password": {"write_only": True}
          }

    def create(self, validated_data):

        man_agent_unique_id = validated_data.pop('man_agent_unique_id', None)
        man_agent_otp_key = validated_data.pop('man_agent_otp_key', None)
        password = validated_data.pop('password')
        created_by = validated_data.get('created_by')
        
        man_agent_to_link = None
        if created_by == 'agent':
            if not man_agent_unique_id or not man_agent_otp_key:
                raise serializers.ValidationError({
                    "error": "Unique ID and OTP Key are mandatory for registration through an agent."
                })

            try:
                man_agent_profile = Profile.objects.get(unique_id=man_agent_unique_id)

                man_agent_config = ManAgentConfig.objects.filter(
                    man_agent=man_agent_profile.user,
                    otp_key=man_agent_otp_key, 
                    is_active=True
                ).first()

                if not man_agent_config:
                    raise serializers.ValidationError({
                        "otp_key": "Invalid OTP "
                    })
                man_agent_to_link = man_agent_profile.user
                
            except Profile.DoesNotExist:
                raise serializers.ValidationError({
                    "unique_id": "Not found agent"
                })

        with transaction.atomic():
            user = User(**validated_data)
            user.set_password(password)
            user.save()


            if man_agent_to_link:
                ReferralRelation.objects.create(
                    man_agent=man_agent_to_link, 
                    referred_user=user,
                    used_otp_key=man_agent_otp_key
                )
        


        return user





class UserRegisterSerializer(serializers.ModelSerializer[User]):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [

            "name", 
            "email", 
            "phone_number", 
            "division", 
            "district", 
            "upazila", 
            "id_type",
            "gender",
            "created_by",
            "password",
        ]

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user




class OfferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Offer
        fields = ["id", "name","allowed_platforms", "tokens", "description", "price", "duration_days", "is_active", 'target_audience']


class SubscriptionSerializer(serializers.ModelSerializer):
    offer = OfferSerializer(read_only=True)
    offer_id = serializers.PrimaryKeyRelatedField(queryset=Offer.objects.all(), source='offer', write_only=True)


    class Meta:
        model = Subscription
        fields = ["id", "profile", "offer", "offer_id", "start_date", "end_date", "is_active"]
        read_only_fields = ["profile", "start_date", "end_date", "is_active"]
    
    def create(self, validated_data):
        user_profile = self.context['request'].user.profile
        validated_data['profile'] = user_profile
        subscription = super().create(validated_data)
        return subscription


class CustomerOrderSerializer(serializers.ModelSerializer):
    
    form_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = CustomerOrder
        fields = ['id', 'form_id', 'customer_name', 'phone_number', 'district', 'upazila', 'address', 'product_name','status', 'extra_info', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        form_id = validated_data.pop('form_id', None)
        if not form_id:
            raise serializers.ValidationError({"form_id": "Form ID is required to place an order."})
        
        
        try:
            order_form = OrderForm.objects.get(form_id=form_id)
            user = order_form.user
        except OrderForm.DoesNotExist:
            raise serializers.ValidationError({"form_id": "Invalid Form ID."})

        return CustomerOrder.objects.create(user=user, **validated_data)
