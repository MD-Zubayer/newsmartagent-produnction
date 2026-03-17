import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='WhatsAppInstance',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('instance_name', models.CharField(default='default', max_length=100)),
                ('phone_number', models.CharField(blank=True, max_length=20, null=True)),
                ('baileys_api_url', models.URLField(default='http://newsmartagent-baileys:3001', help_text='Baileys REST API URL (docker internal)')),
                ('status', models.CharField(choices=[('open', 'Connected'), ('connecting', 'Connecting'), ('close', 'Disconnected')], default='close', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='whatsapp_instance', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'WhatsApp Instance',
                'verbose_name_plural': 'WhatsApp Instances',
            },
        ),
        migrations.CreateModel(
            name='WhatsAppMessage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('direction', models.CharField(choices=[('incoming', 'Incoming'), ('outgoing', 'Outgoing')], max_length=10)),
                ('from_phone', models.CharField(max_length=50)),
                ('to_phone', models.CharField(blank=True, max_length=50)),
                ('push_name', models.CharField(blank=True, max_length=100)),
                ('message_text', models.TextField()),
                ('message_id', models.CharField(blank=True, max_length=100)),
                ('ai_reply', models.TextField(blank=True, null=True)),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('instance', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='messages', to='openwa.whatsappinstance')),
            ],
            options={
                'verbose_name': 'WhatsApp Message',
                'verbose_name_plural': 'WhatsApp Messages',
                'ordering': ['-timestamp'],
            },
        ),
    ]
