from django.db import migrations, models
import minio_management.storages

class Migration(migrations.Migration):

    dependencies = [
        ('users', '0030_user_two_factor_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='profile',
            name='profile_photo',
            field=models.ImageField(blank=True, null=True, storage=minio_management.storages.ProfileStorage(), upload_to='photos/'),
        ),
    ]
