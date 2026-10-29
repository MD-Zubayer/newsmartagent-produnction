from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('assunnah', '0011_district_name_bn'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='entry',
            name='post_office',
        ),
    ]
