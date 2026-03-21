from django.db import migrations, models
import django.db.models.deletion
import ckeditor.fields
import minio_management.storages

class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('users', '0030_user_two_factor_fields'),
    ]
    operations = [
        migrations.CreateModel(
            name='Category',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('slug', models.SlugField(blank=True, max_length=120, unique=True)),
            ],
            options={
                'verbose_name_plural': 'Categories',
            },
        ),
        migrations.CreateModel(
            name='BlogPost',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=250)),
                ('slug', models.SlugField(blank=True, max_length=300, unique=True)),
                ('thumbnail', models.ImageField(blank=True, null=True, storage=minio_management.storages.BlogStorage(), upload_to='blog/thumbnails/')),
                ('content', ckeditor.fields.RichTextField()),
                ('views_count', models.PositiveIntegerField(default=0)),
                ('meta_description', models.CharField(help_text='Used for SEO meta description tag.', max_length=160)),
                ('is_published', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='blog_posts', to='users.user')),
                ('category', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='posts', to='blog.category')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
