from django.core.validators import RegexValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0005_promptconfig")]

    operations = [migrations.AlterField(
        model_name="entry",
        name="dakhila_no",
        field=models.CharField(max_length=50, validators=[RegexValidator("^\\d+$", "দাখিলা নম্বর শুধু সংখ্যা হতে হবে")]),
    )]
