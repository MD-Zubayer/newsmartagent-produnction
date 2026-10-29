from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("ai_extensions", "0004_rename_ai_ext_assign_scope_idx_ai_extensio_extensi_065898_idx_and_more")]

    operations = [
        migrations.AddField(
            model_name="extension",
            name="dashboard_visible",
            field=models.BooleanField(default=True),
        ),
    ]
