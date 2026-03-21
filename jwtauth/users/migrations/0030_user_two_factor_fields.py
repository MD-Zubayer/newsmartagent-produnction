from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0029_profile_two_factor_enabled'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='two_factor_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='two_factor_secret',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
    ]

