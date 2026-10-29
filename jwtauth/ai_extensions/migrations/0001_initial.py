from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("aiAgent", "0057_websitevisitor_sender_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="Extension",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.SlugField(max_length=100, unique=True)),
                ("name", models.CharField(max_length=160)),
                ("description", models.TextField(blank=True, default="")),
                ("category", models.CharField(choices=[("prompt", "Prompt"), ("retrieval", "Retrieval"), ("validator", "Validator"), ("formatter", "Formatter"), ("function", "Function")], default="function", max_length=30)),
                ("author", models.CharField(blank=True, default="", max_length=120)),
                ("icon", models.CharField(blank=True, default="", max_length=255)),
                ("is_installed", models.BooleanField(default=True)),
                ("is_enabled", models.BooleanField(default=False)),
                ("manifest", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ("name",)},
        ),
        migrations.CreateModel(
            name="ExtensionVersion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version", models.CharField(max_length=40)),
                ("target", models.CharField(max_length=120)),
                ("entry_point", models.CharField(blank=True, default="", max_length=255)),
                ("config_schema", models.JSONField(blank=True, default=dict)),
                ("default_config", models.JSONField(blank=True, default=dict)),
                ("release_notes", models.TextField(blank=True, default="")),
                ("compatible_base_version", models.CharField(blank=True, default="1.x", max_length=40)),
                ("status", models.CharField(choices=[("draft", "Draft"), ("testing", "Testing"), ("stable", "Stable"), ("quarantined", "Quarantined"), ("retired", "Retired")], default="draft", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="created_ai_extension_versions", to=settings.AUTH_USER_MODEL)),
                ("extension", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="versions", to="ai_extensions.extension")),
            ],
            options={"ordering": ("extension__key", "-created_at")},
        ),
        migrations.CreateModel(
            name="ExtensionAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scope", models.CharField(choices=[("global", "Global"), ("agent", "Agent"), ("user", "User")], default="global", max_length=20)),
                ("config", models.JSONField(blank=True, default=dict)),
                ("is_enabled", models.BooleanField(default=True)),
                ("priority", models.PositiveIntegerField(default=100)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("agent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="extension_assignments", to="aiAgent.agentai")),
                ("extension", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="ai_extensions.extension")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="extension_assignments", to=settings.AUTH_USER_MODEL)),
                ("version", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assignments", to="ai_extensions.extensionversion")),
            ],
            options={"ordering": ("priority", "-updated_at")},
        ),
        migrations.CreateModel(
            name="ExtensionExecutionLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("request_id", models.CharField(db_index=True, max_length=100)),
                ("success", models.BooleanField(default=True)),
                ("latency_ms", models.FloatField(default=0)),
                ("error_message", models.TextField(blank=True, default="")),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("agent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="aiAgent.agentai")),
                ("extension", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="ai_extensions.extension")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                ("version", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="ai_extensions.extensionversion")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddConstraint(model_name="extensionversion", constraint=models.UniqueConstraint(fields=("extension", "version"), name="unique_extension_version")),
        migrations.AddIndex(model_name="extensionassignment", index=models.Index(fields=["extension", "scope", "is_enabled"], name="ai_ext_assign_scope_idx")),
        migrations.AddIndex(model_name="extensionassignment", index=models.Index(fields=["agent", "scope", "is_enabled"], name="ai_ext_agent_scope_idx")),
        migrations.AddIndex(model_name="extensionexecutionlog", index=models.Index(fields=["extension", "version", "created_at"], name="ai_ext_exec_ext_idx")),
        migrations.AddIndex(model_name="extensionexecutionlog", index=models.Index(fields=["agent", "created_at"], name="ai_ext_exec_agent_idx")),
    ]
