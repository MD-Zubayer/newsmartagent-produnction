from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0004_entry_correction_fields")]

    operations = [migrations.CreateModel(
        name="PromptConfig",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("feature", models.CharField(choices=[("arabic_check", "Arabic AI Check"), ("auto_field_fill", "AI Auto Field Fill")], max_length=30)),
            ("mode", models.CharField(choices=[("default", "Use default"), ("append", "Append custom"), ("replace", "Replace default")], default="append", max_length=10)),
            ("custom_prompt", models.TextField(blank=True)),
            ("updated_at", models.DateTimeField(auto_now=True)),
            ("collection", models.ForeignKey(on_delete=models.deletion.CASCADE, related_name="prompt_configs", to="assunnah.collection")),
        ],
    ), migrations.AddConstraint(
        model_name="promptconfig",
        constraint=models.UniqueConstraint(fields=("collection", "feature"), name="unique_assunnah_prompt_feature"),
    )]
