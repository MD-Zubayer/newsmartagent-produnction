from django.db import migrations, models


def remove_duplicate_dakhilas(apps, schema_editor):
    Entry = apps.get_model("assunnah", "Entry")
    seen = set()
    duplicate_ids = []
    entries = Entry.objects.order_by("collection_id", "dakhila_no", "id").iterator()
    for entry in entries:
        key = (entry.collection_id, entry.dakhila_no)
        if key in seen:
            duplicate_ids.append(entry.pk)
        else:
            seen.add(key)
    if duplicate_ids:
        Entry.objects.filter(pk__in=duplicate_ids).delete()


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0002_entry_entry_language")]

    operations = [
        migrations.RunPython(remove_duplicate_dakhilas, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="entry",
            constraint=models.UniqueConstraint(
                fields=("collection", "dakhila_no"),
                name="unique_assunnah_dakhila_per_collection",
            ),
        ),
    ]
