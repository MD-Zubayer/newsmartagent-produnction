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


class PromptConfig(models.Model):
    FEATURE_CHOICES = [("arabic_check", "Arabic AI Check"), ("auto_field_fill", "AI Auto Field Fill")]
    MODE_CHOICES = [("default", "Use default"), ("append", "Append custom"), ("replace", "Replace default")]
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="prompt_configs")
    feature = models.CharField(max_length=30, choices=FEATURE_CHOICES)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default="append")
    custom_prompt = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["collection", "feature"], name="unique_assunnah_prompt_feature")]


KNOWN_DISTRICT_AR_TO_BN = {
    "داكا": "ঢাকা",
    "فريدبور": "ফরিদপুর",
    "مادار پور": "মাদারীপুর",
    "مداري بور": "মাদারীপুর",
    "باغرهات": "বাগেরহাট",
    "شريعت بور": "শরীয়তপুর",
    "سريعة بور": "শরীয়তপুর",
    "شريعتبور": "শরীয়তপুর",
    "شريعة بور": "শরীয়তপুর",
    "شريعت پور": "শরীয়তপুর",
    "شريعتپور": "শরীয়তপুর",
    "شرج غنج": "সিরাজগঞ্জ",
    "شيربور": "শেরপুর",
    "جمال بور": "জামালপুর",
    "فتواخالي": "পটুয়াখালী",
    "تبوا خالي": "পটুয়াখালী",
    "كشورغنج": "কিশোরগঞ্জ",
    "زيني دة": "ঝিনাইদহ",
    "بباريا": "ব্রাহ্মণবাড়িয়া",
    "بيباريا": "ব্রাহ্মণবাড়িয়া",
    "كيرانيغنج": "কেরানীগঞ্জ",
    "مومن شاهي": "ময়মনসিংহ",
    "خلنا": "খুলনা",
    "جسر": "যশোর",
    "جشر": "যশোর",
    "جشور": "যশোর",
    "صوادانغا": "চুয়াডাঙ্গা",
    "نواخالى": "নোয়াখালী",
    "ঝালকাঠি": "ঝালকাঠি",
    "جالوكاتي": "ঝালকাঠি",
    "جالوكادي": "ঝালকাঠি",
    "ديناجفور": "দিনাজপুর",
    "ماغورا": "মাগুرا",
    "بريشال": "বরিশাল",
    "غوفالغنج": "গোপালগঞ্জ",
    "بابنا": "পাবনা",
    "منشى غنج": "মুন্সীগঞ্জ",
    "برغونة": "বরগুنا",
    "كشتيا": "কুষ্টিয়া",
    "كوشتيا": "কুষ্টিয়া",
    "بولا": "ভোলা",
    "نتر كونا": "নেত্রকোনা",
    "فيروز بور": "পিরোজপুর",
    "فيروج فور": "পিরোজপুর",
    "غايبا ندا": "গাইবান্ধা",
    "جباءي نباب غنج": "চাঁপাইনবাবগঞ্জ",
    "ناراين غنج": "নারায়ণগঞ্জ",
    "مهربور": "মেহেরপুর",
    "مانيك غنج": "মানিকগঞ্জ",
    "نرائيل": "নড়াইল",
    "ساتخيرا": "সاتক্ষীরা",
    "راجباري": "রাজবাড়ী",
}


KNOWN_DISTRICT_BN_TO_AR = {bangla: arabic for arabic, bangla in KNOWN_DISTRICT_AR_TO_BN.items()}


class District(models.Model):
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="districts")
    name = models.CharField(max_length=100)
    name_bn = models.CharField(max_length=100, blank=True)


    @property
    def arabic_name(self):
        value = (self.name_bn or self.name).strip()
        if any("\u0600" <= character <= "\u06ff" for character in value):
            return value
        return KNOWN_DISTRICT_BN_TO_AR.get(value, value)

    @property
    def display_name(self):
        if self.name_bn:
            return self.name_bn
        return KNOWN_DISTRICT_AR_TO_BN.get(self.name.strip(), self.name)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["collection", "name"], name="unique_assunnah_district")]
        ordering = ["name"]


class Entry(models.Model):
    LANGUAGE_CHOICES = [("bn", "বাংলা"), ("ar", "আরবি")]
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, related_name="entries")
    entry_language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default="bn")
    dakhila_no = models.CharField(max_length=50, validators=[RegexValidator(r"^[0-9০-৯٠-٩]+$", "দাখিলা নম্বর শুধু সংখ্যা হতে হবে")])
    name = models.CharField(max_length=150)
    father_name = models.CharField(max_length=150)
    village = models.CharField(max_length=150)
    thana = models.CharField(max_length=100)
    district = models.ForeignKey(District, on_delete=models.PROTECT, related_name="entries")
    mobile_number = models.CharField(max_length=30)
    blood_group = models.CharField(max_length=10, blank=True)
    education_period = models.CharField(max_length=100, blank=True)
    correction_status = models.CharField(
        max_length=20,
        choices=[("not_checked", "Not checked"), ("suggested", "Suggested"), ("approved", "Approved"), ("rejected", "Rejected")],
        default="not_checked",
    )
    original_data = models.JSONField(default=dict, blank=True)
    corrected_data = models.JSONField(default=dict, blank=True)
    correction_notes = models.TextField(blank=True)
    corrected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["collection", "dakhila_no", "entry_language"], name="unique_assunnah_dakhila_language_per_collection")]
        ordering = ["dakhila_no", "id"]
