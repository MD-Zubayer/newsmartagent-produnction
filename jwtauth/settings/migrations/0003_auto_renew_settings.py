from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'), # Assuming initial is where Offer is defined or similar
        ('settings', '0002_globalsettings'),
    ]

    operations = [
        migrations.AddField(
            model_name='agentsettings',
            name='auto_renew_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='agentsettings',
            name='auto_renew_offer',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='users.offer'),
        ),
    ]
