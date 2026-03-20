from rest_framework import serializers
from users.models import User, Subscription, Offer, Profile, Payment, NSATransfer, WithdrawMethod, CashoutRequest
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from users.models import CustomerOrder, OrderForm
from django.db import transaction
from man_agent.models import ManAgentConfig, ReferralRelation
from aiAgent.serializers import AIProviderModelSerializer
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
        fields = ["user", "id_type", "unique_id", "profile_photo", "created_at", "updated_at", "two_factor_enabled", "word_balance", 'acount_balance', 'commission_balance']


class UserSerializer(serializers.ModelSerializer[User]):
    profile = ProfileSerializer(required=False) # nested serializer
    two_factor_enabled = serializers.SerializerMethodField(read_only=True)

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
            "country",
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
            'is_staff',
            'is_superuser',
            'two_factor_enabled',
        ]



        extra_kwargs = {
            # "url": {"view_name": "user-detail", "lookup_field": "id"},
            # "email": {"read_only": True},
            "password": {"write_only": True},
          }

    def get_two_factor_enabled(self, obj):
        try:
            return getattr(obj.profile, "two_factor_enabled", False)
        except Exception:
            return False

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
            
            try:
                from chat.models import Notification
                Notification.objects.create(
                    user=user,
                    message=f"Welcome {user.name or user.username}! Thank you for joining us. 🎉",
                    type='welcome' # বা আপনার পছন্দের কোনো টাইপ
                )
            except Exception as e:
                print(f"Notification Error: {e}")
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', None)
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update profile fields if provided
        if profile_data:
            profile = instance.profile
            for attr, value in profile_data.items():
                setattr(profile, attr, value)
            profile.save()
            
        return instance




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
    allowed_models = AIProviderModelSerializer(many=True, read_only=True)
    
    class Meta:
        model = Offer
        fields = ["id", "name","allowed_platforms", "allowed_models", "tokens", "description", "price", "duration_days", "is_active", 'target_audience']


class SubscriptionSerializer(serializers.ModelSerializer):
    offer = OfferSerializer(read_only=True)
    offer_id = serializers.PrimaryKeyRelatedField(queryset=Offer.objects.all(), source='offer', write_only=True)


    class Meta:
        model = Subscription
        fields = ["id", "profile", "offer", "offer_id", "start_date", "end_date", "is_active", "remaining_tokens"]
        read_only_fields = ["profile", "start_date", "end_date", "is_active", "remaining_tokens"]
    
    def create(self, validated_data):
        user_profile = self.context['request'].user.profile
        validated_data['profile'] = user_profile
        subscription = super().create(validated_data)
        return subscription


class CustomerOrderSerializer(serializers.ModelSerializer):
    
    form_id = serializers.UUIDField(write_only=True, required=False)
    customer_profile_photo = serializers.SerializerMethodField()

    class Meta:
        model = CustomerOrder
        fields = ['id', 'form_id', 'customer_name', 'customer_profile_photo', 'phone_number', 'district', 'upazila', 'address', 'product_name', 'price', 'status', 'extra_info', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'customer_profile_photo']

    def get_customer_profile_photo(self, obj):
        try:
            request = self.context.get('request')
            if obj.user.profile.profile_photo:
                url = obj.user.profile.profile_photo.url
                if request:
                    return request.build_absolute_uri(url)
                return url
        except Exception:
            pass
        return None

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


class NSATransferSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    receiver_name = serializers.SerializerMethodField()
    sender_unique_id = serializers.SerializerMethodField()
    receiver_unique_id = serializers.SerializerMethodField()
    class Meta:
        model = NSATransfer
        fields = ['id', 'sender_name', 'receiver_name', 'sender_unique_id', 'receiver_unique_id', 'amount', 'created_at']

    def get_sender_name(self, obj):
        # name না থাকলে username বা email দেখাবে যাতে None না আসে
        user = obj.sender
        return getattr(user, 'name', None) or getattr(user, 'username', None) or user.email

    def get_receiver_name(self, obj):
        user = obj.receiver
        return getattr(user, 'name', None) or getattr(user, 'username', None) or user.email

    def get_sender_unique_id(self, obj):
        # সরাসরি প্রোফাইল থেকে আইডি আনা
        try:
            return obj.sender.profile.unique_id
        except:
            return "N/A"

    def get_receiver_unique_id(self, obj):
        try:
            return obj.receiver.profile.unique_id
        except:
            return "N/A"


class WithdrawMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = WithdrawMethod
        fields = ['id', 'method', 'account_type', 'account_number', 'account_name', 'bank_name', 'branch_name', 'routing_number', 'card_holder_name', 'card_type', 'is_default', 'created_at']
        read_only_fields = ['id', 'is_default', 'created_at']

    def validate(self, data):
        method = data.get('method')
        account_type = data.get('account_type')
        if method in ['bkash', 'nagad', 'rocket'] and not account_type:
            raise serializers.ValidationError({"account_type": "Account type (Personal/Agent) is required for mobile banking."})
        if method == 'card':
            if not data.get('card_holder_name'):
                raise serializers.ValidationError({"card_holder_name": "Card holder name is required."})
            if not data.get('card_type'):
                raise serializers.ValidationError({"card_type": "Card type (Visa/Mastercard) is required."})
            # Validate 16-digit card number (strip spaces from frontend formatting)
            card_num = data.get('account_number', '').replace(' ', '')
            if not card_num.isdigit() or len(card_num) != 16:
                raise serializers.ValidationError({"account_number": "Card number must be exactly 16 digits."})
            data['account_number'] = card_num  # Store without spaces
        return data

    def create(self, validated_data):
        profile = self.context['request'].user.profile
        validated_data['profile'] = profile
        
        # If this is the first method, make it default
        if not WithdrawMethod.objects.filter(profile=profile).exists():
            validated_data['is_default'] = True
            
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # If setting this to default, unset others
        is_default = validated_data.get('is_default', instance.is_default)
        if is_default and not instance.is_default:
            WithdrawMethod.objects.filter(profile=instance.profile).update(is_default=False)
            
        return super().update(instance, validated_data)


class CashoutRequestSerializer(serializers.ModelSerializer):
    withdraw_method_details = WithdrawMethodSerializer(source='withdraw_method', read_only=True)
    
    class Meta:
        model = CashoutRequest
        fields = ['id', 'withdraw_method', 'withdraw_method_details', 'balance_type', 'amount', 'status', 'transaction_id', 'admin_note', 'requested_at', 'processed_at']
        read_only_fields = ['id', 'status', 'transaction_id', 'admin_note', 'requested_at', 'processed_at']

    def validate(self, data):
        amount = data.get('amount')
        balance_type = data.get('balance_type', 'commission')
        
        if amount and amount < 500: # Example minimum withdrawal amount
            raise serializers.ValidationError({"amount": "Minimum withdrawal amount is 500 BDT."})
        
        profile = self.context['request'].user.profile
        
        if balance_type == 'commission' and amount > profile.commission_balance:
            raise serializers.ValidationError({"amount": "Insufficient commission balance."})
        elif balance_type == 'account' and amount > profile.acount_balance:
            raise serializers.ValidationError({"amount": "Insufficient account balance."})
            
        return data

    def create(self, validated_data):
        profile = self.context['request'].user.profile
        validated_data['profile'] = profile
        balance_type = validated_data.get('balance_type', 'commission')
        
        # Deduct from profile balance immediately for pending request
        with transaction.atomic():
            if balance_type == 'commission':
                profile.commission_balance -= validated_data['amount']
                profile.save(update_fields=['commission_balance'])
            elif balance_type == 'account':
                profile.acount_balance -= validated_data['amount']
                profile.save(update_fields=['acount_balance'])
                
            cashout_request = super().create(validated_data)
            
        return cashout_request
