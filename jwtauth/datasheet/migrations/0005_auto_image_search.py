from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('datasheet', '0004_spreadsheet_tokens_count'),
    ]

    operations = [
        migrations.AddField(
            model_name='spreadsheet',
            name='auto_image_search',
            field=models.BooleanField(default=False, help_text='Run optional row-based image auto-search when enabled'),
        ),
    ]
