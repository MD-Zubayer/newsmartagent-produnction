from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0007_postcache'),
    ]

    operations = [
        migrations.AddField(
            model_name='conversation',
            name='platform',
            field=models.CharField(choices=[('whatsapp', 'WhatsApp'), ('messenger', 'Messenger')], default='messenger', max_length=20),
        ),
        migrations.AddField(
            model_name='message',
            name='platform',
            field=models.CharField(choices=[('whatsapp', 'WhatsApp'), ('messenger', 'Messenger')], default='messenger', max_length=20),
        ),
        migrations.AlterUniqueTogether(
            name='conversation',
            unique_together={('agentAi', 'contact_id', 'platform')},
        ),
        migrations.AddIndex(
            model_name='conversation',
            index=models.Index(fields=['agentAi', 'contact_id', 'platform'], name='chat_conver_agentAi_3c063a_idx'),
        ),
    ]
