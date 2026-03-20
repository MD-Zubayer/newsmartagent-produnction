from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0028_remove_agentai_settings_fields'),
        ('datasheet', '0002_alter_spreadsheet_colors_alter_spreadsheet_data_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='spreadsheet',
            name='agent',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='spreadsheets', to='aiAgent.agentai'),
        ),
        migrations.AddField(
            model_name='spreadsheet',
            name='scope',
            field=models.CharField(choices=[('global', 'Global (All Agents)'), ('agent_specific', 'Agent Specific')], default='global', max_length=20),
        ),
    ]
