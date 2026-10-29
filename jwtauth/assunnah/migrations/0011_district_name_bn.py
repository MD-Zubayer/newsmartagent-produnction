from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('assunnah', '0010_normalize_dakhila_digits'),
    ]

    operations = [
        migrations.AddField(
            model_name='district',
            name='name_bn',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
