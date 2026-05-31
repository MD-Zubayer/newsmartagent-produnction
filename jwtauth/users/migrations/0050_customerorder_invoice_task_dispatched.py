from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0049_customerorder_invoice_sent'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerorder',
            name='invoice_task_dispatched',
            field=models.BooleanField(default=False, db_index=True),
        ),
    ]
