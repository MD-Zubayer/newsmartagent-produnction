from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courier', '0004_add_steadfast_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='pathaocourierconfig',
            name='name',
            field=models.CharField(blank=True, help_text='Optional config label', max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='pathaocourierconfig',
            name='user',
            field=models.ForeignKey(on_delete=models.CASCADE, related_name='pathao_configs', to=settings.AUTH_USER_MODEL),
        ),
        migrations.AddField(
            model_name='steadfastcourierconfig',
            name='name',
            field=models.CharField(blank=True, help_text='Optional config label', max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name='steadfastcourierconfig',
            name='user',
            field=models.ForeignKey(on_delete=models.CASCADE, related_name='steadfast_configs', to=settings.AUTH_USER_MODEL),
        ),
    ]
