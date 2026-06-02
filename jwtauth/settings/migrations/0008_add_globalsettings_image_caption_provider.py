from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('settings', '0007_globalsettings_youtube_check_interval'),
    ]

    operations = [
        migrations.AddField(
            model_name='globalsettings',
            name='image_caption_provider',
            field=models.CharField(
                choices=[('gemini', 'Gemini'), ('openai', 'OpenAI')],
                default='gemini',
                max_length=20,
                help_text='Default provider to generate image captions for the system.',
            ),
        ),
    ]
