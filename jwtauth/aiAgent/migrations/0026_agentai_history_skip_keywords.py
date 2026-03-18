from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0025_agentai_skip_history'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentai',
            name='history_skip_keywords',
            field=models.TextField(blank=True, help_text='কমা দিয়ে হিস্টোরি স্কিপ কি-ওয়ার্ডগুলো লিখুন', null=True),
        ),
    ]
