from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0033_alter_user_two_factor_secret'),
    ]

    operations = [
        migrations.AddField(
            model_name='facebookpage',
            name='token_expires_at',
            field=models.DateTimeField(blank=True, null=True, help_text='Expiry of the user long-lived token, if provided'),
        ),
        migrations.AddField(
            model_name='facebookpage',
            name='user_access_token',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
    ]
