from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0006_alter_entry_dakhila_no")]

    operations = [migrations.AlterField(
        model_name="entry",
        name="dakhila_no",
        field=models.CharField(max_length=50, validators=[RegexValidator("^[0-9০-৯٠-٩]+$", "দাখিলা নম্বর শুধু সংখ্যা হতে হবে")]),
    )]
