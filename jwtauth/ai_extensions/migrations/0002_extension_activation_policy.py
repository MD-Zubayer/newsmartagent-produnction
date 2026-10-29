from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai_extensions", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="extension",
            name="allow_multiple_active_versions",
            field=models.BooleanField(default=False),
        ),
    ]
