from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='MinioBucket',
            fields=[
                ('name', models.CharField(max_length=255, primary_key=True, serialize=False)),
                ('custom_policy', models.TextField(blank=True, help_text='Provide a custom JSON policy for this bucket. If empty, default policies will be used.', null=True)),
                ('is_public', models.BooleanField(default=False)),
                ('last_sync', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'MinIO Bucket',
                'verbose_name_plural': 'MinIO Buckets',
            },
        ),
    ]
