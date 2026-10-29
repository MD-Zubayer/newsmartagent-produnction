from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai_extensions", "0002_extension_activation_policy")]

    operations = [
        migrations.AddField(
            model_name="extensionversion",
            name="targets",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
