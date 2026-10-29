from collections import defaultdict

from django.db import migrations


def normalize_digits(value):
    return str(value or "").translate(str.maketrans(
        "০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩",
        "01234567890123456789",
    )).strip()


def forwards(apps, schema_editor):
    Entry = apps.get_model("assunnah", "Entry")
    entries = list(Entry.objects.all().order_by("id"))
    groups = defaultdict(list)
    for entry in entries:
        groups[(entry.collection_id, entry.entry_language, normalize_digits(entry.dakhila_no))].append(entry)

    for grouped_entries in groups.values():
        # Keep ambiguous legacy rows unchanged; lookup normalization still handles them safely.
        if len(grouped_entries) > 1:
            continue
        entry = grouped_entries[0]
        normalized = normalize_digits(entry.dakhila_no)
        if normalized != entry.dakhila_no:
            Entry.objects.filter(pk=entry.pk).update(dakhila_no=normalized)


class Migration(migrations.Migration):
    dependencies = [("assunnah", "0009_entry_post_office")]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
