from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="entry",
            name="entry_language",
            field=models.CharField(choices=[("bn", "বাংলা"), ("ar", "আরবি")], default="bn", max_length=2),
        ),
    ]
