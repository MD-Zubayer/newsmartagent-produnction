from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0008_unique_dakhila_per_language")]

    operations = [
        migrations.AddField(
            model_name="entry",
            name="post_office",
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
