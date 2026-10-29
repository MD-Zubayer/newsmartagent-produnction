from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0003_unique_dakhila_per_collection")]

    operations = [
        migrations.AddField(model_name="entry", name="correction_status", field=models.CharField(choices=[("not_checked", "Not checked"), ("suggested", "Suggested"), ("approved", "Approved"), ("rejected", "Rejected")], default="not_checked", max_length=20)),
        migrations.AddField(model_name="entry", name="original_data", field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name="entry", name="corrected_data", field=models.JSONField(blank=True, default=dict)),
        migrations.AddField(model_name="entry", name="correction_notes", field=models.TextField(blank=True)),
        migrations.AddField(model_name="entry", name="corrected_at", field=models.DateTimeField(blank=True, null=True)),
    ]
