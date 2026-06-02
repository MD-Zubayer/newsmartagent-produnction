from django.db import migrations, models
import pgvector.django.indexes
import pgvector.django.vector


class Migration(migrations.Migration):

    dependencies = [
        ('embedding', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='spreadsheetknowledge',
            name='image_url',
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='spreadsheetknowledge',
            name='image_embedding',
            field=pgvector.django.vector.VectorField(blank=True, dimensions=768, null=True),
        ),
        migrations.AddField(
            model_name='spreadsheetknowledge',
            name='image_updated_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='spreadsheetknowledge',
            name='image_source',
            field=models.CharField(blank=True, choices=[('manual', 'Manual'), ('auto_search', 'Auto Search'), ('playwright', 'Playwright')], max_length=20, null=True),
        ),
        migrations.AddIndex(
            model_name='spreadsheetknowledge',
            index=pgvector.django.indexes.HnswIndex(
                name='image_vector_hnsw_idx',
                fields=['image_embedding'],
                m=16,
                ef_construction=64,
                opclasses=['vector_cosine_ops'],
            ),
        ),
    ]
