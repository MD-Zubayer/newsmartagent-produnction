from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0027_smarttranslationmap'),
        ('settings', '0004_agentaisettings'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='agentai',
            name='temperature',
        ),
        migrations.RemoveField(
            model_name='agentai',
            name='max_tokens',
        ),
        migrations.RemoveField(
            model_name='agentai',
            name='skip_history',
        ),
        migrations.RemoveField(
            model_name='agentai',
            name='history_skip_keywords',
        ),
    ]
