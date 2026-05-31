from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0048_customerorder_source_contact_id_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerorder',
            name='invoice_sent',
            field=models.BooleanField(default=False, db_index=True),
        ),
        migrations.AddField(
            model_name='customerorder',
            name='invoice_sent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
