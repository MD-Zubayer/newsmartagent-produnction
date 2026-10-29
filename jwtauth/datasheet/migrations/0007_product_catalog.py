from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):
    dependencies = [
        ("datasheet", "0006_spreadsheet_image_search_log_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Product",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("category", models.CharField(blank=True, default="", max_length=150)),
                ("base_sku", models.CharField(blank=True, default="", max_length=100)),
                ("initial_stock", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("description", models.TextField(blank=True, default="")),
                ("gallery_images", models.JSONField(blank=True, default=list)),
                ("base_price", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("sale_price", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("cost_price", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("weight_kg", models.DecimalField(blank=True, decimal_places=3, max_digits=10, null=True)),
                ("dimension_length_cm", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("dimension_width_cm", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("dimension_height_cm", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("status", models.CharField(choices=[("active", "Active"), ("inactive", "Inactive")], default="active", max_length=10)),
                ("stock_alert_threshold", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("attributes", models.JSONField(blank=True, default=dict)),
                ("warranty_information", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="catalog_products", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-updated_at"]},
        ),
        migrations.CreateModel(
            name="ProductVariant",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("attributes", models.JSONField(blank=True, default=dict)),
                ("sku", models.CharField(blank=True, default="", max_length=100)),
                ("price", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ("stock", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("product", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="variants", to="datasheet.product")),
            ],
            options={"ordering": ["id"]},
        ),
    ]
