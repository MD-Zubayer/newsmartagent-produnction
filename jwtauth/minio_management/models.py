from django.db import models

class MinioBucket(models.Model):
    name = models.CharField(max_length=255, primary_key=True)
    custom_policy = models.TextField(
        blank=True, 
        null=True,
        help_text="Provide a custom JSON policy for this bucket. If empty, default policies will be used."
    )
    is_public = models.BooleanField(default=False)
    last_sync = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "MinIO Bucket"
        verbose_name_plural = "MinIO Buckets"
