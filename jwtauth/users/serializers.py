from rest_framework import serializers
from users.models import (
    User, Subscription, Offer, Profile, Payment, NSATransfer,
    WithdrawMethod, CashoutRequest, Platform, CustomTeamRole, TeamMember,
    get_full_owner_permissions, TEAM_ROLE_PRESETS,
)
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken
from users.models import CustomerOrder, OrderForm
from django.db.models import Q
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
        fields = [
            "user", "id_type", "unique_id", "profile_photo", "created_at", "updated_at",
            "two_factor_enabled", "word_balance", "schedule_balance", "acount_balance",
            "commission_balance", "website_url", "business_email",
            "auto_courier_booking", "default_courier_provider",
            "ai_voice_enabled", "voice_preference", "default_voice_audio"
        ]


class UserSerializer(serializers.ModelSerializer[User]):
    profile = ProfileSerializer(required=False) # nested serializer
    two_factor_enabled = serializers.SerializerMethodField(read_only=True)
    team_context = serializers.SerializerMethodField(read_only=True)

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
            'team_context',
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

    def get_team_context(self, obj):
        try:
            tm = obj.get_active_team_member()
            if tm:
                owner = tm.owner
                team_count = TeamMember.objects.filter(owner=owner, is_active=True).count()
                return {
                    "is_team_member": True,
                    "is_owner": False,
                    "workspace_owner_id": owner.id,
                    "workspace_name": owner.name or owner.email.split("@")[0],
                    "member_id": tm.id,
                    "role_title": tm.custom_role.name if tm.custom_role else tm.role_title,
                    "custom_role_id": tm.custom_role_id,
                    "department": tm.department,
                    "availability_status": tm.availability_status,
                    "permissions": tm.get_effective_permissions(),
                    "team_members_count": team_count,
                }
            team_count = TeamMember.objects.filter(owner=obj, is_active=True).count()
            return {
                "is_team_member": False,
                "is_owner": True,
                "workspace_owner_id": obj.id,
                "workspace_name": obj.name or obj.email.split("@")[0],
                "member_id": None,
                "role_title": "Owner / Admin",
                "custom_role_id": None,
                "department": "general",
                "availability_status": "online",
                "permissions": get_full_owner_permissions(),
                "team_members_count": team_count,
            }
        except Exception:
            return {
                "is_team_member": False,
                "is_owner": True,
                "workspace_owner_id": obj.id,
                "workspace_name": obj.name or "",
                "member_id": None,
                "role_title": "Owner / Admin",
                "custom_role_id": None,
                "department": "general",
                "availability_status": "online",
                "permissions": get_full_owner_permissions(),
                "team_members_count": 0,
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




class PlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = Platform
        fields = ["id", "name", "is_active"]


class OfferSerializer(serializers.ModelSerializer):
    allowed_models = AIProviderModelSerializer(many=True, read_only=True)
    allowed_platforms = PlatformSerializer(many=True, read_only=True)
    
    class Meta:
        model = Offer
        fields = ["id", "name","allowed_platforms", "allowed_models", "tokens", "schedule_messages", "description", "price", "duration_days", "is_active", 'target_audience', 'image_support', 'max_agents_per_platform']


class SubscriptionSerializer(serializers.ModelSerializer):
    offer = OfferSerializer(read_only=True)
    offer_id = serializers.PrimaryKeyRelatedField(queryset=Offer.objects.all(), source='offer', write_only=True)


    class Meta:
        model = Subscription
        fields = ["id", "profile", "offer", "offer_id", "start_date", "end_date", "is_active", "remaining_tokens", "remaining_schedule_messages"]
        read_only_fields = ["profile", "start_date", "end_date", "is_active", "remaining_tokens", "remaining_schedule_messages"]
    
    def create(self, validated_data):
        user_profile = self.context['request'].user.profile
        validated_data['profile'] = user_profile
        subscription = super().create(validated_data)
        # initialize schedule quota from offer
        if subscription.offer and subscription.remaining_schedule_messages == 0:
            subscription.remaining_schedule_messages = getattr(subscription.offer, "schedule_messages", 0)
            subscription.save(update_fields=["remaining_schedule_messages"])
        user_profile.sync_balances()
        return subscription


class CustomerOrderSerializer(serializers.ModelSerializer):
    
    form_id = serializers.UUIDField(write_only=True, required=False)
    customer_profile_photo = serializers.SerializerMethodField()
    customer_info = serializers.SerializerMethodField()
    product_info = serializers.SerializerMethodField()
    order_items = serializers.SerializerMethodField()
    courier_booking_info = serializers.SerializerMethodField()

    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'public_id', 'form_id', 'customer_name', 'customer_profile_photo', 
            'customer_info', 'product_info', 'order_items', 'items',
            'phone_number', 'district', 'upazila', 'address', 
            'product_name', 'price', 'delivery_charge', 'cod_charge', 'cod_bearer', 'courier', 'courier_booking_info',
            'source_platform', 'status', 'call_status', 'call_notes', 'call_confirmed_at', 'extra_info', 
            'city_id', 'zone_id', 'area_id', 'item_weight', 
            'item_quantity', 'special_instruction', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'public_id', 'created_at', 'customer_profile_photo', 'customer_info', 'product_info', 'order_items', 'courier_booking_info', 'call_confirmed_at', 'cod_charge', 'cod_bearer']

    def get_courier_booking_info(self, obj):
        try:
            from courier.models import PathaoBookingLog, SteadFastBookingLog, CourierTimelineEvent
            latest_event = CourierTimelineEvent.objects.filter(order=obj).order_by('-created_at').first()
            event_history = [
                {
                    'event_name': ev.event_name,
                    'status_label': ev.status_label,
                    'reason': ev.reason,
                    'created_at': ev.created_at.isoformat() if ev.created_at else None
                }
                for ev in CourierTimelineEvent.objects.filter(order=obj).order_by('-created_at')[:15]
            ]

            pathao_log = PathaoBookingLog.objects.filter(order=obj).order_by('-id').first()
            if pathao_log:
                is_cancelled = str(pathao_log.status).lower() in ('cancelled', 'deleted')
                return {
                    'is_booked': not is_cancelled,
                    'provider': 'pathao',
                    'provider_label': 'Pathao Courier',
                    'consignment_id': pathao_log.consignment_id,
                    'merchant_order_id': pathao_log.merchant_order_id,
                    'booking_status': pathao_log.status or 'pending',
                    'latest_status_label': latest_event.status_label if latest_event else (pathao_log.status or 'Pending'),
                    'latest_reason': latest_event.reason if latest_event else None,
                    'events': event_history,
                    'booked_at': pathao_log.created_at.isoformat() if pathao_log.created_at else None,
                    'error': None,
                }
            steadfast_log = SteadFastBookingLog.objects.filter(order=obj).order_by('-id').first()
            if steadfast_log:
                is_cancelled = str(steadfast_log.status).lower() in ('cancelled', 'deleted')
                return {
                    'is_booked': not is_cancelled,
                    'provider': 'steadfast',
                    'provider_label': 'SteadFast Courier',
                    'consignment_id': steadfast_log.consignment_id,
                    'merchant_order_id': steadfast_log.merchant_order_id,
                    'booking_status': steadfast_log.status or 'pending',
                    'latest_status_label': latest_event.status_label if latest_event else (steadfast_log.status or 'Pending'),
                    'latest_reason': latest_event.reason if latest_event else None,
                    'events': event_history,
                    'booked_at': steadfast_log.created_at.isoformat() if steadfast_log.created_at else None,
                    'error': None,
                }
        except Exception:
            pass

        # Check if extra_info has a tracking ID or auto-booking error note
        extra = str(obj.extra_info or '')
        error_note = None
        if 'Courier Auto-Booking Error:' in extra:
            error_note = extra.split('Courier Auto-Booking Error:')[-1].strip().split('\n')[0]

        profile = getattr(obj.user, 'profile', None)
        default_provider = getattr(profile, 'default_courier_provider', 'steadfast') if profile else 'steadfast'
        selected_courier = obj.courier if obj.courier and obj.courier != 'manual' else default_provider

        return {
            'is_booked': False,
            'provider': None,
            'selected_provider': selected_courier,
            'provider_label': 'Pathao Courier' if selected_courier == 'pathao' else 'SteadFast Courier',
            'consignment_id': None,
            'booking_status': 'unbooked',
            'error': error_note,
        }

    def get_customer_info(self, obj):
        request = self.context.get('request')
        cust = getattr(obj, 'customer', None)
        contact = getattr(obj, 'contact', None)
        
        platforms = set()
        if obj.source_platform:
            platforms.add(str(obj.source_platform).lower())
        if contact and getattr(contact, 'platform', None):
            platforms.add(str(contact.platform).lower())
            
        avatar_url = None
        has_account = False
        email = None
        display_name = obj.customer_name
        
        if cust:
            has_account = True
            if cust.avatar_url:
                avatar_url = cust.avatar_url
            if cust.name:
                display_name = cust.name
            if cust.email:
                email = cust.email
            try:
                for ident in cust.identities.all():
                    if ident.platform:
                        platforms.add(str(ident.platform).lower())
            except Exception:
                pass
        elif contact:
            if contact.profile_photo_url:
                avatar_url = contact.profile_photo_url
            elif contact.profile_photo:
                try:
                    url = contact.profile_photo.url
                    avatar_url = request.build_absolute_uri(url) if request else url
                except Exception:
                    pass
            if contact.name or contact.push_name:
                display_name = contact.name or contact.push_name

        if not has_account and obj.phone_number:
            try:
                from storefront.models import Customer
                matched_cust = Customer.objects.filter(primary_phone=obj.phone_number).first()
                if matched_cust:
                    has_account = True
                    if not avatar_url and matched_cust.avatar_url:
                        avatar_url = matched_cust.avatar_url
                    if not email and matched_cust.email:
                        email = matched_cust.email
                    for ident in matched_cust.identities.all():
                        if ident.platform:
                            platforms.add(str(ident.platform).lower())
            except Exception:
                pass

        if not platforms:
            platforms.add('web')

        return {
            'has_account': has_account,
            'name': display_name or obj.customer_name,
            'email': email,
            'avatar_url': avatar_url,
            'platforms': sorted(list(platforms)),
            'source_platform': obj.source_platform or 'web',
        }

    def get_customer_profile_photo(self, obj):
        info = self.get_customer_info(obj)
        return info.get('avatar_url')

    def get_product_info(self, obj):
        request = self.context.get('request')
        prod_name = (obj.product_name or '').strip()
        if not prod_name and obj.items and isinstance(obj.items, list) and len(obj.items) > 0:
            first_item = obj.items[0]
            if isinstance(first_item, dict):
                prod_name = (first_item.get('name') or first_item.get('title') or '').strip()
                
        if not prod_name:
            return None
            
        try:
            from datasheet.models import Product
            catalog_prod = Product.objects.filter(
                user=obj.user,
                name__iexact=prod_name
            ).prefetch_related('gallery', 'variants').first()
            
            if not catalog_prod:
                catalog_prod = Product.objects.filter(
                    user=obj.user,
                    name__icontains=prod_name
                ).prefetch_related('gallery', 'variants').first()
                
            if catalog_prod:
                image_url = None
                primary_gallery = catalog_prod.gallery.filter(is_primary=True).first() or catalog_prod.gallery.first()
                if primary_gallery and primary_gallery.image:
                    try:
                        url = primary_gallery.image.url
                        image_url = request.build_absolute_uri(url) if request else url
                    except Exception:
                        pass
                if not image_url and catalog_prod.gallery_images and isinstance(catalog_prod.gallery_images, list) and len(catalog_prod.gallery_images) > 0:
                    img_item = catalog_prod.gallery_images[0]
                    url = img_item.get('image') if isinstance(img_item, dict) else str(img_item)
                    if url:
                        image_url = request.build_absolute_uri(url) if (request and not url.startswith('http')) else url
                        
                effective_stock = sum(float(v.stock or 0) for v in catalog_prod.variants.all()) if catalog_prod.variants.exists() else float(catalog_prod.initial_stock or 0)
                
                return {
                    'id': catalog_prod.id,
                    'name': catalog_prod.name,
                    'sku': catalog_prod.base_sku,
                    'category': catalog_prod.category,
                    'image': image_url,
                    'price': str(catalog_prod.sale_price if catalog_prod.sale_price is not None else catalog_prod.base_price),
                    'stock': effective_stock,
                    'is_catalog': True,
                }
        except Exception:
            pass
            
        return {
            'id': None,
            'name': prod_name,
            'sku': None,
            'category': None,
            'image': None,
            'price': str(obj.price),
            'stock': None,
            'is_catalog': False,
        }

    def get_order_items(self, obj):
        request = self.context.get('request')
        items = []
        if obj.items and isinstance(obj.items, list) and len(obj.items) > 0:
            for item in obj.items:
                if not isinstance(item, dict):
                    continue
                name = item.get('name') or item.get('title') or 'Item'
                qty = item.get('quantity') or item.get('qty') or 1
                price = item.get('price') or 0
                image = item.get('image') or item.get('image_url')
                sku = item.get('sku') or item.get('variant_sku')
                
                if not image and obj.user_id:
                    try:
                        from datasheet.models import Product
                        p = Product.objects.filter(user=obj.user, name__iexact=name).prefetch_related('gallery').first()
                        if p:
                            g = p.gallery.filter(is_primary=True).first() or p.gallery.first()
                            if g and g.image:
                                url = g.image.url
                                image = request.build_absolute_uri(url) if request else url
                    except Exception:
                        pass
                        
                items.append({
                    'name': name,
                    'quantity': qty,
                    'price': price,
                    'image': image,
                    'sku': sku,
                })
        else:
            prod_info = self.get_product_info(obj)
            items.append({
                'name': obj.product_name or 'N/A',
                'quantity': obj.item_quantity or 1,
                'price': obj.price,
                'image': prod_info.get('image') if prod_info else None,
                'sku': prod_info.get('sku') if prod_info else None,
                'category': prod_info.get('category') if prod_info else None,
            })
        return items

    def create(self, validated_data):
        form_id = validated_data.pop('form_id', None)
        if not form_id:
            raise serializers.ValidationError({"form_id": "Form ID is required to place an order."})
        
        
        try:
            order_form = OrderForm.objects.get(form_id=form_id)
            user = order_form.user
        except OrderForm.DoesNotExist:
            raise serializers.ValidationError({"form_id": "Invalid Form ID."})

        product_name = str(validated_data.get('product_name', '') or '').strip()
        item_quantity = validated_data.get('item_quantity', 1) or 1
        try:
            quantity = int(item_quantity)
        except (TypeError, ValueError):
            quantity = 1

        product = user.get_catalog_product(product_name, quantity)
        if not product:
            raise serializers.ValidationError({
                "product_name": "Product not found in your catalog. Please add it first or use a valid catalog product name."
            })
        if product.get('stock') is not None and product.get('stock') < quantity:
            raise serializers.ValidationError({
                "item_quantity": "Requested quantity exceeds available stock."
            })

        validated_data['product_name'] = product.get('name', product_name)
        validated_data['price'] = product.get('price')

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


class CustomTeamRoleSerializer(serializers.ModelSerializer):
    members_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = CustomTeamRole
        fields = ['id', 'name', 'description', 'preset_key', 'permissions', 'members_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'members_count', 'created_at', 'updated_at']

    def get_members_count(self, obj):
        return obj.members.filter(is_active=True).count()


class TeamMemberSerializer(serializers.ModelSerializer):
    user_id = serializers.IntegerField(source='user.id', read_only=True)
    name = serializers.CharField(source='user.name', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', read_only=True)
    custom_role_name = serializers.SerializerMethodField(read_only=True)
    effective_permissions = serializers.SerializerMethodField(read_only=True)
    active_chats_count = serializers.SerializerMethodField(read_only=True)
    resolved_today_count = serializers.SerializerMethodField(read_only=True)
    allowed_agent_ids = serializers.PrimaryKeyRelatedField(
        many=True,
        read_only=False,
        queryset=TeamMember.allowed_agents.field.related_model.objects.all(),
        source='allowed_agents',
        required=False,
    )

    class Meta:
        model = TeamMember
        fields = [
            'id', 'user_id', 'name', 'email', 'phone_number',
            'custom_role', 'custom_role_name', 'role_title', 'department',
            'availability_status', 'permissions_override', 'effective_permissions',
            'allowed_agent_ids', 'max_concurrent_chats', 'is_active',
            'active_chats_count', 'resolved_today_count',
            'last_assigned_at', 'created_at',
        ]
        read_only_fields = ['id', 'user_id', 'name', 'email', 'phone_number', 'last_assigned_at', 'created_at']

    def get_custom_role_name(self, obj):
        return obj.custom_role.name if obj.custom_role else obj.role_title

    def get_effective_permissions(self, obj):
        return obj.get_effective_permissions()

    def get_active_chats_count(self, obj):
        return obj.assigned_contacts.filter(support_status__in=['waiting_human', 'in_progress']).count()

    def get_resolved_today_count(self, obj):
        from django.utils import timezone
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return obj.user.resolved_contacts.filter(resolved_at__gte=today_start).count()

