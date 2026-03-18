from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0024_contact_custom_prompt_contact_custom_instructions'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentai',
            name='skip_history',
            field=models.BooleanField(default=False, help_text='AI call এ মেমোরি/হিস্টোরি ব্যবহার করবে কিনা?'),
        ),
    ]
