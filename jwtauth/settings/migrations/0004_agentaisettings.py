from django.db import migrations, models
import django.db.models.deletion

def migrate_settings_data(apps, schema_editor):
    AgentAI = apps.get_model('aiAgent', 'AgentAI')
    AgentAISettings = apps.get_model('settings', 'AgentAISettings')
    
    for agent in AgentAI.objects.all():
        AgentAISettings.objects.get_or_create(
            agent=agent,
            defaults={
                'temperature': getattr(agent, 'temperature', 0.7),
                'max_tokens': getattr(agent, 'max_tokens', 200),
                'skip_history': getattr(agent, 'skip_history', False),
                'history_skip_keywords': getattr(agent, 'history_skip_keywords', None),
                'history_limit': 3, # Default as requested
            }
        )

class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0027_smarttranslationmap'),
        ('settings', '0003_auto_renew_settings'),
    ]

    operations = [
        migrations.CreateModel(
            name='AgentAISettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('history_limit', models.PositiveIntegerField(default=3, help_text='কয়টি পুরনো মেসেজ এআই-এর কাছে হিস্টোরি হিসেবে পাঠানো হবে? (Default: 3)')),
                ('temperature', models.FloatField(default=0.7)),
                ('max_tokens', models.IntegerField(default=200)),
                ('skip_history', models.BooleanField(default=False)),
                ('history_skip_keywords', models.TextField(blank=True, null=True)),
                ('agent', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='agent_settings', to='aiAgent.agentai')),
            ],
        ),
        migrations.RunPython(migrate_settings_data),
    ]
