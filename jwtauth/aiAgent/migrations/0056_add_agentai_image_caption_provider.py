from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0055_contact_heard_voice_warnings_contact_profile_photo_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentai',
            name='image_caption_provider',
            field=models.CharField(
                max_length=20,
                choices=[('gemini', 'Gemini'), ('openai', 'OpenAI')],
                default='gemini',
                help_text='Select which provider should generate image captions for this agent.',
            ),
        ),
    ]
