from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0028_remove_agentai_settings_fields'),
        ('embedding', '0004_document_full_content_documentknowledge_content_hash'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='agent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='knowledge_documents', to='aiAgent.agentai'),
        ),
        migrations.AddField(
            model_name='document',
            name='scope',
            field=models.CharField(choices=[('global', 'Global (All Agents)'), ('agent_specific', 'Agent Specific')], default='global', max_length=20),
        ),
    ]
