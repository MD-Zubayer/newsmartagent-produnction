from django.conf import settings
from django.db import models


class Extension(models.Model):
    TYPE_CHOICES = (("prompt", "Prompt"), ("retrieval", "Retrieval"), ("validator", "Validator"), ("formatter", "Formatter"), ("function", "Function"))
    key = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    category = models.CharField(max_length=30, choices=TYPE_CHOICES, default="function")
    author = models.CharField(max_length=120, blank=True, default="")
    icon = models.CharField(max_length=255, blank=True, default="")
    is_installed = models.BooleanField(default=True)
    is_enabled = models.BooleanField(default=False)
    # Admin-controlled catalog visibility; hidden extensions remain available to runtime assignments.
    dashboard_visible = models.BooleanField(default=True, help_text="Show this extension in the user Extensions dashboard. Hiding does not disable runtime execution.")
    # False keeps one active version per scope; set true only for explicitly compatible versions.
    allow_multiple_active_versions = models.BooleanField(default=False)
    manifest = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return f"{self.name} ({self.key})"


class ExtensionVersion(models.Model):
    STATUS_CHOICES = (("draft", "Draft"), ("testing", "Testing"), ("stable", "Stable"), ("quarantined", "Quarantined"), ("retired", "Retired"))
    extension = models.ForeignKey(Extension, on_delete=models.CASCADE, related_name="versions")
    version = models.CharField(max_length=40)
    target = models.CharField(max_length=120)
    # A bundle version may expose several hook targets through one entry point.
    targets = models.JSONField(default=list, blank=True)
    entry_point = models.CharField(max_length=255, blank=True, default="")
    config_schema = models.JSONField(default=dict, blank=True)
    default_config = models.JSONField(default=dict, blank=True)
    release_notes = models.TextField(blank=True, default="")
    compatible_base_version = models.CharField(max_length=40, blank=True, default="1.x")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_ai_extension_versions")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("extension__key", "-created_at")
        constraints = [models.UniqueConstraint(fields=("extension", "version"), name="unique_extension_version")]

    def __str__(self):
        return f"{self.extension.key}@{self.version}"


class ExtensionAssignment(models.Model):
    SCOPE_CHOICES = (("global", "Global"), ("agent", "Agent"), ("user", "User"))
    extension = models.ForeignKey(Extension, on_delete=models.CASCADE, related_name="assignments")
    version = models.ForeignKey(ExtensionVersion, on_delete=models.CASCADE, related_name="assignments")
    scope = models.CharField(max_length=20, choices=SCOPE_CHOICES, default="global")
    agent = models.ForeignKey("aiAgent.AgentAI", on_delete=models.CASCADE, null=True, blank=True, related_name="extension_assignments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="extension_assignments")
    config = models.JSONField(default=dict, blank=True)
    is_enabled = models.BooleanField(default=True)
    priority = models.PositiveIntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("priority", "-updated_at")
        indexes = [models.Index(fields=("extension", "scope", "is_enabled")), models.Index(fields=("agent", "scope", "is_enabled"))]

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.version_id and self.version.extension_id != self.extension_id:
            raise ValidationError("Selected version does not belong to this extension.")
        if self.scope == "agent" and not self.agent_id:
            raise ValidationError("Agent scope requires an agent.")
        if self.scope == "user" and not self.user_id:
            raise ValidationError("User scope requires a user.")
        if self.scope == "global" and (self.agent_id or self.user_id):
            raise ValidationError("Global scope cannot have an agent or user.")

    def __str__(self):
        target = self.agent_id or self.user_id or "all"
        return f"{self.extension.key}@{self.version.version} [{self.scope}:{target}]"


class ExtensionExecutionLog(models.Model):
    request_id = models.CharField(max_length=100, db_index=True)
    extension = models.ForeignKey(Extension, on_delete=models.SET_NULL, null=True, blank=True)
    version = models.ForeignKey(ExtensionVersion, on_delete=models.SET_NULL, null=True, blank=True)
    agent = models.ForeignKey("aiAgent.AgentAI", on_delete=models.SET_NULL, null=True, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    success = models.BooleanField(default=True)
    latency_ms = models.FloatField(default=0)
    error_message = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [models.Index(fields=("extension", "version", "created_at")), models.Index(fields=("agent", "created_at"))]
