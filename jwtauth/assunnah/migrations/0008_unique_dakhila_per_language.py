from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0007_alter_entry_dakhila_no")]

    operations = [
        migrations.RemoveConstraint(
            model_name="entry",
            name="unique_assunnah_dakhila_per_collection",
        ),
        migrations.AddConstraint(
            model_name="entry",
            constraint=models.UniqueConstraint(
                fields=("collection", "dakhila_no", "entry_language"),
                name="unique_assunnah_dakhila_language_per_collection",
            ),
        ),
    ]
