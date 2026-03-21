from django.db import migrations, models


def copy_numbers_from_whatsappinstance(apps, schema_editor):
    AgentAI = apps.get_model('aiAgent', 'AgentAI')
    WhatsAppInstance = apps.get_model('openwa', 'WhatsAppInstance')

    # Build user -> phone mapping
    phone_by_user = {
        inst.user_id: inst.phone_number
        for inst in WhatsAppInstance.objects.exclude(phone_number__isnull=True).exclude(phone_number__exact='')
    }

    for agent in AgentAI.objects.filter(platform='whatsapp'):
        if not agent.number:
            phone = phone_by_user.get(agent.user_id)
            if phone:
                agent.number = phone
                agent.save(update_fields=['number'])


def reverse_copy(apps, schema_editor):
    # No-op; safe to leave numbers in place
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0019_dashboardailog_message_id'),
        ('openwa', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentai',
            name='number',
            field=models.CharField(blank=True, db_index=True, max_length=50, null=True),
        ),
        migrations.RunPython(copy_numbers_from_whatsappinstance, reverse_copy),
    ]
