# Generated manually on 2026-03-18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('aiAgent', '0022_contact'),
    ]

    operations = [
        migrations.AddField(
            model_name='contact',
            name='push_name',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
