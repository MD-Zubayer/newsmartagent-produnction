from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0026_agentai_history_skip_keywords'),
    ]

    operations = [
        migrations.CreateModel(
            name='SmartTranslationMap',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('source_text', models.CharField(db_index=True, max_length=255, unique=True)),
                ('target_text', models.CharField(db_index=True, max_length=255)),
                ('is_active', models.BooleanField(db_index=True, default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Smart Translation Map',
                'verbose_name_plural': 'Smart Translation Maps',
                'ordering': ['source_text'],
            },
        ),
    ]
