import uuid
from django.db import models
from django.utils import timezone


def generate_public_id() -> str:
  return f"NSA-{uuid.uuid4().hex[:6].upper()}"


class CommunityReport(models.Model):
  CATEGORY_CHOICES = [
      ("Bug", "Bug"),
      ("Feedback", "Feedback"),
      ("Feature", "Feature"),
  ]
  STATUS_CHOICES = [
      ("Open", "Open"),
      ("In Review", "In Review"),
      ("Resolved", "Resolved"),
  ]

  public_id = models.CharField(max_length=16, unique=True, default=generate_public_id, editable=False)
  category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default="Feedback")
  title = models.CharField(max_length=200)
  details = models.TextField()
  name = models.CharField(max_length=120, blank=True)
  email = models.EmailField(blank=True)
  status = models.CharField(max_length=12, choices=STATUS_CHOICES, default="Open")
  created_at = models.DateTimeField(default=timezone.now)
  updated_at = models.DateTimeField(auto_now=True)
  closed_at = models.DateTimeField(null=True, blank=True)

  class Meta:
    ordering = ("-created_at",)

  def __str__(self):
    return f"{self.public_id} | {self.title}"

  @property
  def like_count(self):
    return self.likes.count()

  @property
  def comment_count(self):
    return self.comments.count()


class CommunityReply(models.Model):
  report = models.ForeignKey(CommunityReport, related_name="replies", on_delete=models.CASCADE)
  author_name = models.CharField(max_length=120, default="NSA Team")
  text = models.TextField()
  created_at = models.DateTimeField(default=timezone.now)

  class Meta:
    ordering = ("created_at",)

  def __str__(self):
    return f"{self.report.public_id} reply by {self.author_name}"


class ReportLike(models.Model):
  """IP-ভিত্তিক anonymous like — প্রতি IP একটি করে like দিতে পারবে।"""
  report = models.ForeignKey(CommunityReport, related_name="likes", on_delete=models.CASCADE)
  ip_address = models.GenericIPAddressField()
  created_at = models.DateTimeField(default=timezone.now)

  class Meta:
    unique_together = ("report", "ip_address")
    ordering = ("-created_at",)

  def __str__(self):
    return f"Like on {self.report.public_id} from {self.ip_address}"


class ReportComment(models.Model):
  """যে কেউ comment করতে পারবে (login ছাড়া)।"""
  report = models.ForeignKey(CommunityReport, related_name="comments", on_delete=models.CASCADE)
  author_name = models.CharField(max_length=120, default="Anonymous")
  text = models.TextField()
  created_at = models.DateTimeField(default=timezone.now)

  class Meta:
    ordering = ("created_at",)

  def __str__(self):
    return f"Comment on {self.report.public_id} by {self.author_name}"
