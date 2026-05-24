# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0053_prompttokenreport'),
    ]

    operations = [
        migrations.AddField(
            model_name='widgetsettings',
            name='enable_cancel',
            field=models.BooleanField(default=True, help_text='Allow visitors to close/hide the widget icon'),
        ),
        migrations.AddField(
            model_name='widgetsettings',
            name='enable_drag',
            field=models.BooleanField(default=False, help_text='Allow visitors to drag and move the widget bubble anywhere'),
        ),
    ]
