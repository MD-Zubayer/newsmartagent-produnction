from django.db import models
from django.conf import settings
from pgvector.django import VectorField, HnswIndex
import re


_SKU_ALIASES = {
    "পাঞ্জাবি": "PNJ", "পাঞ্জাবী": "PNJ", "panjabi": "PNJ",
    "mobile": "MOB", "মোবাইল": "MOB", "shirt": "SHT", "শার্ট": "SHT",
    "black": "BLK", "কালো": "BLK", "white": "WHT", "সাদা": "WHT",
    "red": "RED", "লাল": "RED", "blue": "BLU", "নীল": "BLU",
    "green": "GRN", "সবুজ": "GRN",
}


def _sku_words(value):
    value = str(value or "").strip().lower()
    for source, target in _SKU_ALIASES.items():
        value = value.replace(source, target.lower())
    return re.findall(r"[a-z0-9]+", value)


def _normalize_sku(value):
    value = re.sub(r"[^A-Z0-9-]+", "-", str(value or "").upper())
    return re.sub(r"-+", "-", value).strip("-")[:100]


def _unique_base_sku(product):
    category_words = _sku_words(product.category)
    name_words = _sku_words(product.name)
    category = (category_words[0] if category_words else "PRD")[:3].upper()
    numeric_model = next((word.upper() for word in reversed(name_words) if any(char.isdigit() for char in word)), None)
    if len(name_words) >= 2:
        if numeric_model and numeric_model not in name_words[:1]:
            model = (name_words[1][:2] + numeric_model if numeric_model.isdigit() else numeric_model).upper()
        else:
            model = "".join(name_words[1:3])[:6].upper()
        candidate = f"{name_words[0][:3].upper()}-{model}"
    elif name_words:
        candidate = f"{category}-{name_words[0][:6].upper()}"
    else:
        candidate = category
    candidate = _normalize_sku(candidate)[:15] or "PRD"
    counter = 1
    while Product.objects.filter(base_sku=candidate).exclude(pk=getattr(product, "pk", None)).exists():
        suffix = f"-{counter:02d}"
        candidate = f"{candidate[:15-len(suffix)]}{suffix}"
        counter += 1
    return candidate


def _unique_variant_sku(variant):
    base = _normalize_sku(variant.product.base_sku) or _unique_base_sku(variant.product)
    tokens = []
    for key, value in sorted((variant.attributes or {}).items()):
        value_words = _sku_words(value)
        if value_words:
            tokens.append("".join(value_words)[:6].upper())
    candidate = _normalize_sku("-".join([base] + tokens))[:100] if tokens else f"{base}-V01"
    counter = 1
    while ProductVariant.objects.filter(sku=candidate).exclude(pk=getattr(variant, "pk", None)).exists():
        suffix = f"-{counter:02d}"
        candidate = f"{candidate[:100-len(suffix)]}{suffix}"
        counter += 1
    return candidate


# Create your models here.


class Spreadsheet(models.Model):

    title = models.CharField(max_length=255, default='Untiteled Sheet')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='spreadsheets')

    rows = models.PositiveIntegerField(default=20)
    cols = models.PositiveIntegerField(default=20)
    
    # 🔥 নতুুন যুক্ত করা হয়েছে (Scope Control)
    KNOWLEDGE_SCOPE = [
        ('global', 'Global (All Agents)'),
        ('agent_specific', 'Agent Specific'),
    ]
    scope = models.CharField(max_length=20, choices=KNOWLEDGE_SCOPE, default='global')
    agent = models.ForeignKey('aiAgent.AgentAI', on_delete=models.SET_NULL, null=True, blank=True, related_name='spreadsheets')

    data = models.JSONField(default=dict,help_text="Stores cell values as {'0-1': 'Hello'}", blank=True, null=True)
    tokens_count = models.IntegerField(default=0, help_text="Total tokens consumed by the spreadsheet data")
    colors = models.JSONField(default=dict, help_text="Stores cell colors as {'0-1': '#ffffff'}", blank=True, null=True)
    styles = models.JSONField(default=dict, help_text="Stores cell styles as {'0-1': {'fontWeight': 'bold'}}", blank=True, null=True)
    auto_image_search = models.BooleanField(default=False, help_text="Run optional row-based image auto-search when enabled")
    image_search_source_url = models.TextField(blank=True, default='', help_text="Target website URL to restrict image search")
    image_search_log = models.TextField(blank=True, default='', help_text="Logs of the latest auto image search execution")

    is_dark_mode = models.BooleanField(default=False)
    zoom_level = models.PositiveIntegerField(default=100)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if getattr(self, 'data', None):
            try:
                import tiktoken
                encoding = tiktoken.get_encoding('cl100k_base')
                
                # Combine all text from all cells
                text_content = ""
                if isinstance(self.data, dict):
                    for val in self.data.values():
                        if val is not None:
                            text_content += str(val) + " "
                elif isinstance(self.data, str):
                    text_content = self.data

                # Some approximation if tiktoken throws issue or exact length
                if text_content.strip():
                    self.tokens_count = len(encoding.encode(text_content))
                else:
                    self.tokens_count = 0
            except Exception:
                # Fallback approximation
                text_len = len(str(self.data)) if self.data else 0
                self.tokens_count = text_len // 4
        else:
            self.tokens_count = 0
            
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.title} - {self.user.email}'
        
    class Meta:
        ordering = ['-updated_at']

class Product(models.Model):
    """Structured catalog data used as the source of truth for product queries."""
    STATUS_CHOICES = (("active", "Active"), ("inactive", "Inactive"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="catalog_products")
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=150, blank=True, default="")
    base_sku = models.CharField(max_length=100, unique=True, blank=True, default="")
    initial_stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description = models.TextField(blank=True, default="")
    gallery_images = models.JSONField(default=list, blank=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sale_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    dimension_length_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dimension_width_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    dimension_height_cm = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="active")
    stock_alert_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    attributes = models.JSONField(default=dict, blank=True)
    warranty_information = models.TextField(blank=True, default="")
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.base_sku:
            self.base_sku = _normalize_sku(self.base_sku)
        else:
            self.base_sku = _unique_base_sku(self)
        super().save(*args, **kwargs)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]


class ProductActivityLog(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="activity_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=80)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    attributes = models.JSONField(default=dict, blank=True)
    sku = models.CharField(max_length=100, unique=True, blank=True, default="")
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    stock = models.DecimalField(max_digits=12, decimal_places=2, default=0)


    def save(self, *args, **kwargs):
        if self.sku:
            self.sku = _normalize_sku(self.sku)
        else:
            self.sku = _unique_variant_sku(self)
        super().save(*args, **kwargs)

    class Meta:
        ordering = ["id"]



class ProductImageAsset(models.Model):
    PROCESSING_CHOICES = (("pending", "Pending"), ("processing", "Processing"), ("ready", "Ready"), ("failed", "Failed"))
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="product_image_assets")
    image = models.ImageField(upload_to="products/library/")
    filename = models.CharField(max_length=255, blank=True, default="")
    alt_text = models.CharField(max_length=255, blank=True, default="")
    image_caption = models.TextField(blank=True, default="")
    image_embedding = VectorField(dimensions=768, null=True, blank=True)
    caption_embedding = VectorField(dimensions=768, null=True, blank=True)
    processing_status = models.CharField(max_length=20, choices=PROCESSING_CHOICES, default="pending")
    processing_error = models.TextField(blank=True, default="")
    embedding_version = models.CharField(max_length=64, blank=True, default="")
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "-created_at"]
        indexes = [
            HnswIndex(name="product_asset_image_hnsw", fields=["image_embedding"], m=16, ef_construction=64, opclasses=["vector_cosine_ops"]),
            HnswIndex(name="product_asset_caption_hnsw", fields=["caption_embedding"], m=16, ef_construction=64, opclasses=["vector_cosine_ops"]),
        ]


class ProductImageAssetLink(models.Model):
    asset = models.ForeignKey(ProductImageAsset, on_delete=models.CASCADE, related_name="links")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="image_asset_links")
    variant = models.ForeignKey(ProductVariant, on_delete=models.SET_NULL, null=True, blank=True, related_name="image_asset_links")
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("asset", "product", "variant")]


class ProductGalleryImage(models.Model):
    PROCESSING_CHOICES = (
        ("pending", "Pending"),
        ("processing", "Processing"),
        ("ready", "Ready"),
        ("failed", "Failed"),
    )
    SOURCE_CHOICES = (
        ("manual", "Manual"),
        ("imported", "Imported"),
    )

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="gallery")
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="gallery_images",
    )
    image = models.ImageField(upload_to="products/gallery/")
    alt_text = models.CharField(max_length=255, blank=True, default="")
    image_caption = models.TextField(blank=True, default="")
    image_embedding = VectorField(dimensions=768, null=True, blank=True)
    caption_embedding = VectorField(dimensions=768, null=True, blank=True)
    processing_status = models.CharField(max_length=20, choices=PROCESSING_CHOICES, default="pending")
    processing_error = models.TextField(blank=True, default="")
    embedding_version = models.CharField(max_length=64, blank=True, default="")
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default="manual")
    is_primary = models.BooleanField(default=False)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position", "id"]
        indexes = [
            HnswIndex(
                name="product_gallery_image_hnsw_idx",
                fields=["image_embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
            HnswIndex(
                name="product_gallery_caption_hnsw",
                fields=["caption_embedding"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def save(self, *args, **kwargs):
        if self.variant_id and self.variant.product_id != self.product_id:
            raise ValueError("Product image variant must belong to the same product.")
        if self.is_primary:
            ProductGalleryImage.objects.filter(
                product_id=self.product_id,
                variant_id=self.variant_id,
                is_primary=True,
            ).exclude(pk=self.pk).update(is_primary=False)
        super().save(*args, **kwargs)


class ProductCategory(models.Model):
    """
    Hierarchical product categories.
    Can be global system categories (user=None) or seller custom-created categories (user=seller).
    Supports multi-level parent-child relationship (e.g. Automotive > Car Electronics > Alarms).
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="custom_product_categories",
        help_text="Null for global system categories; set to specific merchant for custom user categories.",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=180, blank=True, default="")
    full_path = models.CharField(max_length=500, db_index=True, blank=True, default="")
    level = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["full_path", "name"]
        indexes = [
            models.Index(fields=["user", "full_path"]),
            models.Index(fields=["user", "name"]),
        ]

    def __str__(self):
        return self.full_path or self.name

    def save(self, *args, **kwargs):
        self.name = self.name.strip()
        if self.parent:
            self.level = self.parent.level + 1
            parent_path = self.parent.full_path or self.parent.name
            self.full_path = f"{parent_path} > {self.name}"
        else:
            self.level = 0
            self.full_path = self.name
        super().save(*args, **kwargs)

