from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('storefront', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerShopHistory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('last_seen_at', models.DateTimeField(auto_now=True, db_index=True)),
                ('order_count', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('customer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shop_history', to='storefront.customer')),
                ('merchant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='customer_shop_history', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-last_seen_at']},
        ),
        migrations.AddConstraint(
            model_name='customershophistory',
            constraint=models.UniqueConstraint(fields=('customer', 'merchant'), name='unique_customer_shop_history'),
        ),
    ]
