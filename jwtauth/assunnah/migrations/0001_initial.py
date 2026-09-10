from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name="Collection",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="As-Sunnah", max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
            ],
        ),
        migrations.CreateModel(
            name="District",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=100)),
                ("collection", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="districts", to="assunnah.collection")),
            ],
            options={"ordering": ["name"]},
        ),
        migrations.CreateModel(
            name="Entry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("dakhila_no", models.CharField(max_length=50)),
                ("name", models.CharField(max_length=150)),
                ("father_name", models.CharField(max_length=150)),
                ("village", models.CharField(max_length=150)),
                ("thana", models.CharField(max_length=100)),
                ("mobile_number", models.CharField(max_length=30)),
                ("blood_group", models.CharField(blank=True, max_length=10)),
                ("education_period", models.CharField(blank=True, max_length=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("collection", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="assunnah.collection")),
                ("district", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="entries", to="assunnah.district")),
            ],
            options={"ordering": ["dakhila_no", "id"]},
        ),
        migrations.AddConstraint(
            model_name="district",
            constraint=models.UniqueConstraint(fields=("collection", "name"), name="unique_assunnah_district"),
        ),
    ]
