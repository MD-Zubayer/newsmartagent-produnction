# Generated migration for SteadFast models

from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('courier', '0003_pathaozoneprice'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SteadFastCourierConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('api_key', models.CharField(max_length=255)),
                ('api_secret', models.CharField(max_length=255)),
                ('is_sandbox', models.BooleanField(default=True, help_text='Check to use SteadFast Sandbox environment')),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='steadfast_config', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='SteadFastCity',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('city_id', models.IntegerField(unique=True)),
                ('city_name', models.CharField(max_length=255)),
            ],
        ),
        migrations.CreateModel(
            name='SteadFastArea',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('area_id', models.IntegerField(unique=True)),
                ('area_name', models.CharField(max_length=255)),
                ('city', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='areas', to='courier.steadfastcity', to_field='city_id')),
            ],
        ),
        migrations.CreateModel(
            name='SteadFastAreaPrice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('city_id', models.IntegerField()),
                ('area_id', models.IntegerField()),
                ('weight', models.FloatField(default=0.5)),
                ('delivery_fee', models.DecimalField(decimal_places=2, max_digits=10)),
                ('cod_charge', models.DecimalField(decimal_places=2, default=0.0, max_digits=10)),
                ('total_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'indexes': [
                    models.Index(fields=['city_id', 'area_id', 'weight'], name='courier_ste_city_id_abc123_idx'),
                ],
                'unique_together': {('city_id', 'area_id', 'weight')},
            },
        ),
        migrations.CreateModel(
            name='SteadFastBookingLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('consignment_id', models.CharField(help_text='Tracking ID returned by SteadFast', max_length=100, unique=True)),
                ('merchant_order_id', models.CharField(max_length=100)),
                ('status', models.CharField(default='pending', max_length=100)),
                ('response_data', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='steadfast_bookings', to='users.customerorder')),
            ],
        ),
    ]
