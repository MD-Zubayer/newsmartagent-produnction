from rest_framework import serializers
from datasheet.models import Spreadsheet, Product, ProductVariant, ProductGalleryImage, ProductImageAsset, ProductImageAssetLink, ProductActivityLog, ProductCategory
from datasheet.services import sync_product_search_document
from datasheet.product_search import invalidate_product_cache




class SpreadsheetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Spreadsheet
        fields = '__all__'
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class ProductVariantSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)
    sku = serializers.CharField(required=False, allow_blank=True, validators=[])
    image_url = serializers.SerializerMethodField(read_only=True)

    def get_image_url(self, obj):
        img = obj.gallery_images.first()
        if img and img.image:
            return img.image.url
        link = obj.image_asset_links.select_related("asset").first()
        if link and link.asset and link.asset.image:
            return link.asset.image.url
        return None

    class Meta:
        model = ProductVariant
        fields = ["id", "attributes", "sku", "price", "stock", "image_url"]


class ProductGalleryImageSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(use_url=True, read_only=True)
    variant_id = serializers.PrimaryKeyRelatedField(
        source="variant",
        queryset=ProductVariant.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ProductGalleryImage
        fields = [
            "id", "image", "variant_id", "alt_text", "image_caption",
            "processing_status", "processing_error", "embedding_version",
            "source", "is_primary", "position", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "image", "image_caption", "processing_status",
            "processing_error", "embedding_version", "source",
            "created_at", "updated_at",
        ]

    def validate_variant_id(self, variant):
        product = self.context.get("product")
        if variant and product and variant.product_id != product.id:
            raise serializers.ValidationError("Variant does not belong to this product.")
        return variant


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, required=False)
    gallery = serializers.SerializerMethodField()

    def get_gallery(self, obj):
        result = []
        seen_urls = set()
        for g in obj.gallery.all().order_by("position", "id"):
            url = g.image.url if g.image else None
            if url:
                seen_urls.add(url)
                result.append({
                    "id": g.id,
                    "asset_id": None,
                    "link_id": None,
                    "image": url,
                    "variant_id": g.variant_id,
                    "alt_text": g.alt_text,
                    "image_caption": g.image_caption,
                    "processing_status": g.processing_status,
                    "is_primary": g.is_primary,
                    "position": g.position,
                    "source": g.source,
                })
        for link in obj.image_asset_links.select_related("asset").order_by("position", "id"):
            asset = link.asset
            url = asset.image.url if asset and asset.image else None
            if url and url not in seen_urls:
                seen_urls.add(url)
                result.append({
                    "id": asset.id,
                    "asset_id": asset.id,
                    "link_id": link.id,
                    "image": url,
                    "variant_id": link.variant_id,
                    "alt_text": asset.alt_text,
                    "image_caption": asset.image_caption,
                    "processing_status": asset.processing_status,
                    "is_primary": False if result else True,
                    "position": link.position,
                    "source": "library",
                })
        for raw_url in (obj.gallery_images or []):
            if raw_url and raw_url not in seen_urls:
                seen_urls.add(raw_url)
                result.append({
                    "id": None,
                    "image": raw_url,
                    "variant_id": None,
                    "alt_text": "",
                    "image_caption": "",
                    "processing_status": "ready",
                    "is_primary": False if result else True,
                    "position": len(result),
                    "source": "imported",
                })
        return result

    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ["id", "user", "created_at", "updated_at", "is_archived"]

    def validate(self, attrs):
        variants = attrs.get("variants")
        if variants:
            seen_skus = set()
            for v_data in variants:
                sku = (v_data.get("sku") or "").strip()
                if not sku:
                    continue
                norm_sku = sku.upper()
                if norm_sku in seen_skus:
                    raise serializers.ValidationError({
                        "variants": f"Duplicate SKU '{sku}' found within variants."
                    })
                seen_skus.add(norm_sku)

                v_id = v_data.get("id")
                qs = ProductVariant.objects.filter(sku__iexact=sku)
                if v_id:
                    qs = qs.exclude(id=v_id)
                if qs.exists():
                    raise serializers.ValidationError({
                        "variants": f"Variant SKU '{sku}' is already in use by another variant."
                    })
        return attrs

    def create(self, validated_data):
        variants = validated_data.pop("variants", [])
        product = Product.objects.create(user=self.context["request"].user, **validated_data)
        for item in variants:
            ProductVariant.objects.create(product=product, **item)
        sync_product_search_document(product)
        invalidate_product_cache(product.user_id)
        try:
            from datasheet.tasks import index_product_vector_task
            index_product_vector_task.delay(product.id)
        except Exception:
            pass
        return product

    def update(self, instance, validated_data):
        variants = validated_data.pop("variants", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()
        if variants is not None:
            existing_variants = {v.id: v for v in instance.variants.all()}
            existing_by_sku = {v.sku: v for v in existing_variants.values() if v.sku}
            kept_ids = set()
            for item in variants:
                variant_id = item.get("id")
                sku = item.get("sku", "")
                variant = None
                if variant_id and variant_id in existing_variants:
                    variant = existing_variants[variant_id]
                elif sku and sku in existing_by_sku:
                    variant = existing_by_sku[sku]
                if variant:
                    for k, val in item.items():
                        if k != "id":
                            setattr(variant, k, val)
                    variant.save()
                    kept_ids.add(variant.id)
                else:
                    create_data = {k: val for k, val in item.items() if k != "id"}
                    new_variant = ProductVariant.objects.create(product=instance, **create_data)
                    kept_ids.add(new_variant.id)
            instance.variants.exclude(id__in=kept_ids).delete()
        sync_product_search_document(instance)
        invalidate_product_cache(instance.user_id)
        try:
            from datasheet.tasks import index_product_vector_task
            index_product_vector_task.delay(instance.id)
        except Exception:
            pass
        return instance

class ProductImageAssetSerializer(serializers.ModelSerializer):
    image = serializers.ImageField(use_url=True, read_only=True)
    links = serializers.SerializerMethodField()
    file_size = serializers.SerializerMethodField()
    dimensions = serializers.SerializerMethodField()

    def get_links(self, obj):
        result = []
        for link in obj.links.select_related("product", "variant"):
            variant_label = None
            if link.variant:
                attrs = ", ".join(f"{k}: {v}" for k, v in (link.variant.attributes or {}).items())
                variant_label = attrs or link.variant.sku or f"Variant #{link.variant.id}"
            result.append({
                "id": link.id,
                "asset_id": link.asset_id,
                "product_id": link.product_id,
                "variant_id": link.variant_id,
                "product_name": link.product.name,
                "product_sku": link.product.base_sku,
                "variant_sku": link.variant.sku if link.variant else None,
                "variant_label": variant_label,
                "position": link.position,
                "created_at": link.created_at,
            })
        return result

    def get_file_size(self, obj):
        try:
            return obj.image.size if obj.image else None
        except Exception:
            return None

    def get_dimensions(self, obj):
        try:
            if obj.image:
                return {"width": obj.image.width, "height": obj.image.height}
        except Exception:
            pass
        return None

    class Meta:
        model = ProductImageAsset
        fields = [
            "id", "image", "filename", "alt_text", "image_caption", "links",
            "processing_status", "processing_error", "embedding_version",
            "position", "file_size", "dimensions", "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "image", "processing_status", "processing_error",
            "embedding_version", "file_size", "dimensions", "created_at", "updated_at",
        ]


class ProductImageAssetLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImageAssetLink
        fields = ["id", "asset", "product", "variant", "position", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductActivityLogSerializer(serializers.ModelSerializer):
    user_email = serializers.SerializerMethodField()

    def get_user_email(self, obj):
        return getattr(obj.user, "email", None) if obj.user else None

    class Meta:
        model = ProductActivityLog
        fields = ["id", "action", "details", "created_at", "user", "user_email"]
        read_only_fields = ["id", "created_at", "user", "user_email"]


class ProductCategorySerializer(serializers.ModelSerializer):
    is_custom = serializers.SerializerMethodField()

    def get_is_custom(self, obj):
        return obj.user_id is not None

    class Meta:
        model = ProductCategory
        fields = ["id", "name", "parent", "full_path", "level", "is_custom", "created_at"]
        read_only_fields = ["id", "full_path", "level", "is_custom", "created_at"]

