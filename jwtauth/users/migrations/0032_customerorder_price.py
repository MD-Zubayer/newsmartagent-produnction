from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0031_profile_profile_photo'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerorder',
            name='price',
            field=models.DecimalField(decimal_places=2, default=0.0, max_digits=10),
        ),
    ]
