from django.core.management.base import BaseCommand

from ai_extensions.models import Extension, ExtensionVersion
from ai_extensions.provider_adapters import TARGETS


class Command(BaseCommand):
    help = "Register built-in AI extensions without enabling them."

    def handle(self, *args, **options):
        extension, _ = Extension.objects.update_or_create(
            key="strict-grounded-prompt",
            defaults={
                "name": "Strict Grounded Prompt",
                "description": "Adds grounding and uncertainty rules to the existing base prompt.",
                "category": "prompt",
                "author": "New Smart Agent",
                "is_installed": True,
                "is_enabled": False,
                "allow_multiple_active_versions": False,
                "manifest": {"allow_multiple_active_versions": False},
            },
        )
        version, created = ExtensionVersion.objects.update_or_create(
            extension=extension,
            version="1.0.0",
            defaults={
                "target": "prompt",
                "entry_point": "ai_extensions.builtins:StrictGroundedPrompt",
                "status": "stable",
                "config_schema": {"instruction": {"type": "string"}, "override_mode": {"type": "string", "enum": ["append", "replace"]}},
                "default_config": {"override_mode": "append"},
                "release_notes": "Initial safe grounding prompt extension.",
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Registered {version} ({'created' if created else 'updated'}). Enable it from admin/dashboard."))
        provider_temperatures = {
            "main-answer-provider": 0.6,
            "dashboard-assistant-provider": 0.5,
            "summary-provider": 0.2,
            "classification-provider": 0,
            "memory-provider": 0,
            "image-analysis-provider": 0.2,
            "image-rerank-provider": 0,
            "rag-rerank-provider": 0,
            "payment-verification-provider": 0,
            "audio-transcription-provider": 0,
            "courier-parser-provider": 0,
        }
        for key, name in TARGETS.items():
            ext, _ = Extension.objects.update_or_create(
                key=key,
                defaults={"name": name, "description": "Approved OpenAI provider adapter with documented scope, model configuration, validation, logging, cache isolation, and Gemini fallback.", "category": "function", "author": "New Smart Agent", "is_installed": True, "is_enabled": False, "manifest": {"provider": "openai", "allow_multiple_active_versions": False}},
            )
            class_name = {"main-answer-provider": "OpenAIMainAnswerExtension", "classification-provider": "OpenAIClassificationExtension", "memory-provider": "OpenAIMemoryExtension", "image-analysis-provider": "OpenAIImageAnalysisExtension", "image-rerank-provider": "OpenAIImageRerankExtension", "rag-rerank-provider": "OpenAIRAGRerankExtension", "payment-verification-provider": "OpenAIPaymentVerificationExtension", "audio-transcription-provider": "OpenAIAudioTranscriptionExtension", "summary-provider": "OpenAISummaryExtension", "courier-parser-provider": "OpenAICourierParserExtension", "dashboard-assistant-provider": "OpenAIDashboardAssistantExtension"}[key]
            ExtensionVersion.objects.update_or_create(
                extension=ext, version="1.1.2",
                defaults={"target": "provider", "targets": ["provider"], "entry_point": f"ai_extensions.provider_adapters:{class_name}", "status": "stable", "config_schema": {"provider": {"type": "string"}, "model": {"type": "string"}, "temperature": {"type": "number"}, "prompt": {"type": "string"}, "override_mode": {"type": "string", "enum": ["append", "replace"]}}, "default_config": {"provider": "openai", "model": "gpt-4o-mini", "temperature": provider_temperatures.get(key, 0), "override_mode": "append"}, "release_notes": "v1.1.2: Fixed main-answer structured JSON enforcement, prevented duplicate prompt composition, added malformed-response safety, and preserved Gemini fallback. v1.1.1 temperature tuning remains included."},
            )
            self.stdout.write(self.style.SUCCESS(f"Registered provider target: {key}"))
        hybrid, _ = Extension.objects.update_or_create(
            key="hybrid-search",
            defaults={
                "name": "Hybrid Search",
                "description": "Combines PostgreSQL Full-Text Search with pgvector retrieval.",
                "category": "retrieval",
                "author": "New Smart Agent",
                "is_installed": True,
                "is_enabled": False,
                "allow_multiple_active_versions": False,
                "manifest": {"allow_multiple_active_versions": False},
            },
        )
        ExtensionVersion.objects.update_or_create(
            extension=hybrid,
            version="1.0.0",
            defaults={
                "target": "retrieval",
                "entry_point": "ai_extensions.hybrid:HybridSearchExtension",
                "status": "stable",
                "config_schema": {"top_k": {"type": "integer"}, "fulltext_weight": {"type": "number"}, "vector_weight": {"type": "number"}},
                "default_config": {"top_k": 8, "fulltext_weight": 0.4, "vector_weight": 0.6},
                "release_notes": "Initial PostgreSQL FTS + pgvector hybrid retrieval.",
            },
        )
        function_extension, _ = Extension.objects.update_or_create(
            key="safe-response-postprocess",
            defaults={
                "name": "Safe Response Postprocess",
                "description": "Ensures the standard AI response fields exist after provider execution.",
                "category": "function",
                "author": "New Smart Agent",
                "is_installed": True,
                "is_enabled": False,
                "allow_multiple_active_versions": False,
                "manifest": {"allow_multiple_active_versions": False},
            },
        )
        ExtensionVersion.objects.update_or_create(
            extension=function_extension,
            version="1.0.0",
            defaults={
                "target": "function",
                "entry_point": "ai_extensions.function_builtins:SafeResponsePostprocess",
                "status": "stable",
                "config_schema": {},
                "default_config": {},
                "release_notes": "Initial response postprocess function extension.",
            },
        )

