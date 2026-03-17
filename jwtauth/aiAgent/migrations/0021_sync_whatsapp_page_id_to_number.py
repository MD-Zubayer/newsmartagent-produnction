from django.db import migrations


def set_page_id_to_number(apps, schema_editor):
    AgentAI = apps.get_model('aiAgent', 'AgentAI')
    for agent in AgentAI.objects.filter(platform='whatsapp'):
        if agent.number:
            # Overwrite page_id with number for WhatsApp agents
            agent.page_id = agent.number
            agent.save(update_fields=['page_id'])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0020_agentai_number'),
    ]

    operations = [
        migrations.RunPython(set_page_id_to_number, reverse_noop),
    ]
