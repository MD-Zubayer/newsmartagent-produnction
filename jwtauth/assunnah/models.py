from datetime import timedelta

from django.db import models
from django.utils import timezone
from django.core.validators import RegexValidator


class Collection(models.Model):
    name = models.CharField(max_length=150, default="As-Sunnah")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(days=60)
        return super().save(*args, **kwargs)

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at


class District(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="districts")
    name = models.CharField(max_length=100)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["collection", "name"], name="unique_assunnah_district")]
        ordering = ["name"]


class Entry(models.Model):
    LANGUAGE_CHOICES = [("bn", "বাংলা"), ("ar", "আরবি")]
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="entries")
    entry_language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default="bn")
    dakhila_no = models.CharField(max_length=50, validators=[RegexValidator(r"^\d+$", "দাখিলা নম্বর শুধু সংখ্যা হতে হবে")])
    name = models.CharField(max_length=150)
    father_name = models.CharField(max_length=150)
    village = models.CharField(max_length=150)
    thana = models.CharField(max_length=100)
    district = models.ForeignKey(District, on_delete=models.PROTECT, related_name="entries")
    mobile_number = models.CharField(max_length=30)
    blood_group = models.CharField(max_length=10, blank=True)
    education_period = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["dakhila_no", "id"]
