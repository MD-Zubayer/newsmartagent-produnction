from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import community.models


class Migration(migrations.Migration):
  initial = True

  dependencies = []

  operations = [
      migrations.CreateModel(
          name="CommunityReport",
          fields=[
              ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
              ("public_id", models.CharField(default=community.models.generate_public_id, editable=False, max_length=16, unique=True)),
              ("category", models.CharField(choices=[("Bug", "Bug"), ("Feedback", "Feedback"), ("Feature", "Feature")], default="Feedback", max_length=20)),
              ("title", models.CharField(max_length=200)),
              ("details", models.TextField()),
              ("name", models.CharField(blank=True, max_length=120)),
              ("email", models.EmailField(blank=True, max_length=254)),
              ("status", models.CharField(choices=[("Open", "Open"), ("In Review", "In Review"), ("Resolved", "Resolved")], default="Open", max_length=12)),
              ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
              ("updated_at", models.DateTimeField(auto_now=True)),
              ("closed_at", models.DateTimeField(blank=True, null=True)),
          ],
          options={"ordering": ("-created_at",)},
      ),
      migrations.CreateModel(
          name="CommunityReply",
          fields=[
              ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
              ("author_name", models.CharField(default="NSA Team", max_length=120)),
              ("text", models.TextField()),
              ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
              ("report", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="replies", to="community.communityreport")),
          ],
          options={"ordering": ("created_at",)},
      ),
  ]
