from rest_framework import serializers
from .models import Customer, CustomerIdentity, CustomerAddress, CheckoutSession, CustomerShopHistory, StorefrontPromotion
from users.models import CustomerOrder
from .services.tracking import build_order_tracking_timeline


class CustomerIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerIdentity
        fields = ['id', 'platform', 'platform_user_id', 'display_name', 'created_at']


class CustomerAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerAddress
        fields = [
            'id', 'recipient_name', 'phone', 'full_address',
            'district', 'upazila', 'courier_location_ids', 'is_default', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class CustomerSerializer(serializers.ModelSerializer):
    identities = CustomerIdentitySerializer(many=True, read_only=True)
    addresses = CustomerAddressSerializer(many=True, read_only=True)

    class Meta:
        model = Customer
        fields = ['id', 'name', 'email', 'avatar_url', 'primary_phone', 'identities', 'addresses', 'created_at']
        read_only_fields = ['id', 'email', 'created_at']


class CustomerShopHistorySerializer(serializers.ModelSerializer):
    merchant_id = serializers.IntegerField(source='merchant.id', read_only=True)
    name = serializers.SerializerMethodField()
    logo = serializers.SerializerMethodField()
    last_seen_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = CustomerShopHistory
        fields = ['merchant_id', 'name', 'logo', 'last_seen_at', 'order_count']

    def get_name(self, obj):
        profile = getattr(obj.merchant, 'profile', None)
        return (
            getattr(profile, 'shop_name', None)
            or getattr(obj.merchant, 'name', None)
            or obj.merchant.email.split('@')[0]
        )

    def get_logo(self, obj):
        profile = getattr(obj.merchant, 'profile', None)
        photo = getattr(profile, 'profile_photo', None)
        try:
            return photo.url if photo else None
        except Exception:
            return None


class CheckoutSessionSerializer(serializers.ModelSerializer):
    merchant_id = serializers.IntegerField(source='merchant.id', read_only=True)
    merchant_name = serializers.SerializerMethodField()
    merchant_shop_name = serializers.SerializerMethodField()
    merchant_avatar = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()
    checkout_prefill = serializers.SerializerMethodField()
    active_promotions = serializers.SerializerMethodField()
    unverified_order = serializers.SerializerMethodField()
    voice_config = serializers.SerializerMethodField()

    class Meta:
        model = CheckoutSession
        fields = [
            'id', 'code', 'items', 'subtotal', 'delivery_charge', 'total_price',
            'currency', 'status', 'expires_at', 'source_platform', 'is_expired',
            'merchant_id', 'merchant_name', 'merchant_shop_name', 'merchant_avatar', 'checkout_prefill',
            'active_promotions', 'unverified_order', 'voice_config', 'created_at'
        ]

    def _find_unverified_order(self, obj):
        if hasattr(self, '_cached_unverified_order_id') and getattr(self, '_cached_unverified_order_obj_id', None) == obj.id:
            return self._cached_unverified_order

        from datetime import timedelta
        from django.utils import timezone
        cutoff = timezone.now() - timedelta(hours=24)
        unverified_call_statuses = ['calling', 'unverified_call', 'uncalled', '']

        # 1. Check direct orders created on this CheckoutSession
        order = CustomerOrder.objects.filter(
            checkout_session=obj,
            status='pending',
            call_status__in=unverified_call_statuses
        ).order_by('-created_at').first()

        # 2. If not on this exact session, check if the same Contact or Customer has a recent unverified pending order for the same product
        if not order:
            first_item = obj.items[0] if (isinstance(obj.items, list) and len(obj.items) > 0 and isinstance(obj.items[0], dict)) else {}
            prod_name = (first_item.get('name') or '').strip()
            if obj.contact:
                qs = CustomerOrder.objects.filter(
                    user=obj.merchant,
                    contact=obj.contact,
                    status='pending',
                    call_status__in=unverified_call_statuses,
                    created_at__gte=cutoff
                )
                if prod_name:
                    qs = qs.filter(product_name__icontains=prod_name[:30])
                order = qs.order_by('-created_at').first()
            elif obj.customer:
                qs = CustomerOrder.objects.filter(
                    user=obj.merchant,
                    customer=obj.customer,
                    status='pending',
                    call_status__in=unverified_call_statuses,
                    created_at__gte=cutoff
                )
                if prod_name:
                    qs = qs.filter(product_name__icontains=prod_name[:30])
                order = qs.order_by('-created_at').first()

        self._cached_unverified_order_obj_id = obj.id
        self._cached_unverified_order = order
        self._cached_unverified_order_id = order.id if order else None
        return order

    def get_unverified_order(self, obj):
        order = self._find_unverified_order(obj)
        if not order:
            return None
        return CustomerOrderStorefrontSerializer(order, context=self.context).data

    def get_voice_config(self, obj):
        order = self._find_unverified_order(obj)
        if not order:
            return None
        try:
            from storefront.services.voice_engine import resolve_voice_for_order
            shop_name = self.get_merchant_shop_name(obj)
            return resolve_voice_for_order(obj.merchant, order.items or obj.items, order.price or obj.subtotal, shop_name)
        except Exception:
            return None

    def get_merchant_name(self, obj):
        return obj.merchant.name or obj.merchant.email.split('@')[0]

    def get_merchant_shop_name(self, obj):
        if hasattr(obj.merchant, 'profile') and getattr(obj.merchant.profile, 'shop_name', None):
            return obj.merchant.profile.shop_name
        return obj.merchant.name or "New Smart Agent Shop"

    def get_merchant_avatar(self, obj):
        # Use a stable API URL. ProfileStorage signed URLs expire and can be
        # cached by the shop, which breaks older seller logos.
        profile = getattr(obj.merchant, 'profile', None)
        if not profile or not getattr(profile, 'profile_photo', None):
            return None
        from django.urls import reverse
        path = reverse('storefront:merchant_avatar', kwargs={'merchant_id': obj.merchant_id})
        request = self.context.get('request')
        return request.build_absolute_uri(path) if request else path

    def get_is_expired(self, obj):
        return obj.is_expired()

    def get_checkout_prefill(self, obj):
        metadata = obj.metadata if isinstance(obj.metadata, dict) else {}
        address = None
        if obj.customer:
            address = obj.customer.addresses.order_by('-is_default', '-updated_at').first()
        unverified = self._find_unverified_order(obj)
        return {
            "customer_name": (
                (unverified.customer_name if unverified else "")
                or metadata.get("customer_name")
                or (obj.customer.name if obj.customer else "")
                or (obj.contact.push_name if (obj.contact and getattr(obj.contact, 'push_name', None)) else "")
            ),
            "phone": (
                (unverified.phone_number if unverified else "")
                or metadata.get("phone")
                or (obj.customer.primary_phone if obj.customer else "")
            ),
            "address": (
                (unverified.address if unverified else "")
                or metadata.get("address")
                or (address.full_address if address else "")
            ),
            "district": (
                (unverified.district if unverified else "")
                or metadata.get("district")
                or (address.district if address else "")
            ),
            "upazila": (
                (unverified.upazila if unverified else "")
                or metadata.get("upazila")
                or (address.upazila if address else "")
            ),
            "courier_location_ids": metadata.get("courier_location_ids") or (address.courier_location_ids if address else {}) or {},
        }

    def get_active_promotions(self, obj):
        try:
            from storefront.services.promotion_engine import get_active_promotions_for_merchant
            promos = get_active_promotions_for_merchant(obj.merchant)
            return [
                {
                    "id": p.id,
                    "title": p.title,
                    "promotion_type": p.promotion_type,
                    "banner_message": p.banner_message or p.title,
                    "min_order_amount": float(p.min_order_amount or 0.0),
                    "min_quantity": p.min_quantity,
                    "discount_percentage": float(p.discount_percentage or 0.0),
                    "discount_amount": float(p.discount_amount or 0.0),
                    "is_free_shipping": p.is_free_shipping,
                    "coupon_code": p.coupon_code or "",
                    "end_date": p.end_date.isoformat() if p.end_date else None,
                    "show_countdown_timer": p.show_countdown_timer,
                }
                for p in promos
            ]
        except Exception:
            return []


class CustomerOrderStorefrontSerializer(serializers.ModelSerializer):
    total_price = serializers.SerializerMethodField()
    shop_name = serializers.SerializerMethodField()
    tracking = serializers.SerializerMethodField()
    product_image = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

    class Meta:
        model = CustomerOrder
        fields = [
            'id', 'public_id', 'customer_name', 'phone_number', 'address',
            'district', 'upazila', 'product_name', 'product_image', 'items', 'price', 'delivery_charge', 'cod_charge', 'cod_bearer', 'total_price',
            'courier', 'status', 'call_status', 'call_notes', 'source_platform', 'shop_name', 'tracking',
            'created_at', 'updated_at'
        ]

    def get_total_price(self, obj):
        return float(obj.price + (obj.delivery_charge or 0))

    def get_shop_name(self, obj):
        if hasattr(obj.user, 'profile') and getattr(obj.user.profile, 'shop_name', None):
            return obj.user.profile.shop_name
        return obj.user.name or obj.user.email.split('@')[0]

    def get_tracking(self, obj):
        return build_order_tracking_timeline(obj)

    def _resolve_item_image(self, item, merchant):
        if isinstance(item, dict) and item.get('image_url'):
            return item.get('image_url')
        
        # Try finding image from Product catalog by product_id or name
        from datasheet.models import Product
        product = None
        if isinstance(item, dict) and item.get('product_id'):
            product = Product.objects.filter(id=item.get('product_id')).prefetch_related('gallery').first()
        
        if not product and isinstance(item, dict) and item.get('name'):
            product = Product.objects.filter(user=merchant, name__iexact=item.get('name')).prefetch_related('gallery').first()
            if not product:
                product = Product.objects.filter(name__iexact=item.get('name')).prefetch_related('gallery').first()

        if product:
            if product.gallery_images and isinstance(product.gallery_images, list) and product.gallery_images[0]:
                return product.gallery_images[0]
            gal = product.gallery.filter(image__isnull=False).first()
            if gal and gal.image:
                return gal.image.url
        return ''

    def get_items(self, obj):
        raw_items = obj.items if isinstance(obj.items, list) else []
        enriched = []
        for itm in raw_items:
            if not isinstance(itm, dict):
                continue
            item_copy = dict(itm)
            if not item_copy.get('image_url'):
                item_copy['image_url'] = self._resolve_item_image(item_copy, obj.user)
            enriched.append(item_copy)
        return enriched

    def get_product_image(self, obj):
        items = self.get_items(obj)
        for itm in items:
            if itm.get('image_url'):
                return itm.get('image_url')

        # Fallback using order product_name
        if obj.product_name:
            from datasheet.models import Product
            prod = Product.objects.filter(user=obj.user, name__icontains=obj.product_name.split(',')[0].strip()).prefetch_related('gallery').first()
            if not prod:
                prod = Product.objects.filter(name__icontains=obj.product_name.split(',')[0].strip()).prefetch_related('gallery').first()
            if prod:
                if prod.gallery_images and isinstance(prod.gallery_images, list) and prod.gallery_images[0]:
                    return prod.gallery_images[0]
                gal = prod.gallery.filter(image__isnull=False).first()
                if gal and gal.image:
                    return gal.image.url
        return ''


class StorefrontPromotionSerializer(serializers.ModelSerializer):
    applicable_product_ids = serializers.PrimaryKeyRelatedField(
        many=True, read_only=False, queryset=StorefrontPromotion.applicable_products.field.related_model.objects.all(),
        source='applicable_products', required=False
    )
    applicable_products_details = serializers.SerializerMethodField(read_only=True)

    def get_applicable_products_details(self, obj):
        details = []
        for p in obj.applicable_products.all():
            img_url = ""
            gal_primary = p.gallery.filter(is_primary=True, image__isnull=False).first()
            if gal_primary and gal_primary.image:
                img_url = gal_primary.image.url
            elif p.gallery_images and isinstance(p.gallery_images, list) and len(p.gallery_images) > 0 and p.gallery_images[0]:
                img_url = p.gallery_images[0]
            elif p.gallery.filter(image__isnull=False).exists():
                g = p.gallery.filter(image__isnull=False).first()
                if g and g.image:
                    img_url = g.image.url
            elif p.image_asset_links.select_related("asset").exists():
                l = p.image_asset_links.select_related("asset").first()
                if l and l.asset and l.asset.image:
                    img_url = l.asset.image.url
            try:
                gal_primary = p.gallery.filter(is_primary=True, image__isnull=False).first()
                if gal_primary and gal_primary.image:
                    img_url = gal_primary.image.url
                elif p.gallery.filter(image__isnull=False).exists():
                    g = p.gallery.filter(image__isnull=False).first()
                    if g and g.image:
                        img_url = g.image.url
                elif p.gallery_images and isinstance(p.gallery_images, list) and len(p.gallery_images) > 0 and p.gallery_images[0]:
                    img_url = p.gallery_images[0]
                elif p.image_asset_links.select_related("asset").exists():
                    l = p.image_asset_links.select_related("asset").first()
                    if l and l.asset and l.asset.image:
                        img_url = l.asset.image.url
            except Exception:
                img_url = ""

            details.append({
                "id": p.id,
                "name": p.name,
                "base_price": str(p.base_price),
                "sale_price": str(p.sale_price) if p.sale_price is not None else None,
                "image": img_url,
                "status": p.status,
            })
        return details

    class Meta:
        model = StorefrontPromotion
        fields = [
            'id', 'title', 'description', 'promotion_type', 'coupon_code',
            'min_order_amount', 'min_quantity', 'applicable_districts', 'applicable_categories',
            'applicable_product_ids', 'applicable_products_details', 'discount_percentage', 'discount_amount', 'is_free_shipping',
            'start_date', 'end_date', 'show_countdown_timer', 'banner_message',
            'max_total_usage', 'times_used', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'times_used', 'created_at', 'updated_at', 'applicable_products_details']
