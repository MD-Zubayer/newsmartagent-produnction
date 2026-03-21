# Generated manually on 2026-03-18

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0021_sync_whatsapp_page_id_to_number'),
    ]

    operations = [
        migrations.CreateModel(
            name='Contact',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('identifier', models.CharField(db_index=True, max_length=255)),
                ('name', models.CharField(blank=True, max_length=255, null=True)),
                ('is_auto_reply_enabled', models.BooleanField(default=True)),
                ('platform', models.CharField(choices=[('whatsapp', 'WhatsApp'), ('messenger', 'Messenger')], max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('agent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='contacts', to='aiAgent.agentai')),
            ],
            options={
                'verbose_name': 'Contact',
                'verbose_name_plural': 'Contacts',
                'unique_together': {('agent', 'identifier')},
            },
        ),
    ]
