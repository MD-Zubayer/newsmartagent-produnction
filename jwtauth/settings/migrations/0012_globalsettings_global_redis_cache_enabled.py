from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("settings", "0011_agentaisettings_agent_cache_enabled_and_more")]

    operations = [
        migrations.AddField(
            model_name="globalsettings",
            name="global_redis_cache_enabled",
            field=models.BooleanField(default=True, help_text="System-wide Redis response caching master switch. Disabling this bypasses response cache for every agent."),
        ),
    ]
