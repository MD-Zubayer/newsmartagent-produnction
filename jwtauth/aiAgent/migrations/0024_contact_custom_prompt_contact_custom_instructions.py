from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0023_contact_push_name'),
    ]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='custom_instructions',
            field=models.TextField(blank=True, help_text='Additional instructions for this contact', null=True),
        ),
        migrations.AddField(
            model_name='contact',
            name='custom_prompt',
            field=models.TextField(blank=True, help_text='Custom system prompt for this specific contact', null=True),
        ),
    ]
