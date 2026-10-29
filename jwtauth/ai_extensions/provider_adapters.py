"""Approved OpenAI provider adapters.

These classes are deliberately server-side code.  Dashboard users can select
configuration and an entry point, but cannot upload or execute Python.
"""
import base64
import hashlib
import json
import logging
from typing import Any

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


TARGETS = {
    "main-answer-provider": "Main Answer GPT",
    "classification-provider": "Classification GPT",
    "memory-provider": "Memory Extraction GPT",
    "image-analysis-provider": "Image Analysis GPT Vision",
    "image-rerank-provider": "Image Reranking GPT",
    "rag-rerank-provider": "RAG Product Reranking GPT",
    "payment-verification-provider": "Payment Verification GPT Vision",
    "audio-transcription-provider": "Audio Transcription OpenAI",
    "summary-provider": "Summary GPT",
    "courier-parser-provider": "Courier Address Parser GPT",
    "dashboard-assistant-provider": "Dashboard Assistant GPT",
}


def _jsonable(value):
    if isinstance(value, bytes):
        return {"sha256": hashlib.sha256(value).hexdigest(), "size": len(value)}
    if isinstance(value, dict):
        return {str(k): _jsonable(v) for k, v in sorted(value.items(), key=lambda item: str(item[0]))}
    if isinstance(value, (list, tuple)):
        return [_jsonable(v) for v in value]
    return value


def _hash(value):
    raw = json.dumps(_jsonable(value), ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def _text(response):
    return (getattr(response.choices[0].message, "content", "") or "").strip()


class OpenAIProviderExtension:
    target = "provider"

    def __init__(self, config=None):
        self.config = config or {}
        self.model = self.config.get("model", "gpt-4o-mini")
        self.temperature = self.config.get("temperature", 0)
        self.timeout = float(self.config.get("timeout", 30))

    def _client(self):
        from openai import OpenAI
        kwargs = {"api_key": self.config.get("api_key") or getattr(settings, "OPENAI_API_KEY", "")}
        if self.config.get("base_url"):
            kwargs["base_url"] = self.config["base_url"]
        return OpenAI(**kwargs)

    def _cache_key(self, payload, context):
        if not self.config.get("cache", True):
            return None
        return "ai-ext:{target}:agent:{agent}:provider:openai:model:{model}:ext:{version}:cfg:{cfg}:prompt:{prompt}:message:{message}".format(
            target=self.target,
            agent=getattr(context.get("agent"), "id", "global"),
            model=self.model,
            version=context.get("extension_version", "unknown"),
            cfg=context.get("extension_config_hash", _hash(self.config)),
            prompt=_hash(payload.get("prompt", payload.get("system_prompt", ""))),
            message=_hash(payload.get("message", payload.get("messages", payload))),
        )

    def _cached(self, payload, context, call):
        key = self._cache_key(payload, context)
        if key:
            cached = cache.get(key)
            if cached is not None:
                return cached
        result = call()
        if key and result is not None:
            cache.set(key, result, timeout=int(self.config.get("cache_ttl", 3600)))
        return result

    def _chat(self, system_prompt, user_content, history=None, json_mode=False, max_tokens=1024, context=None):
        extension_prompt = self.config.get("prompt", self.config.get("extension_prompt", ""))
        mode = self.config.get("override_mode", "append")
        if extension_prompt and not (context or {}).get("_prompt_precomposed"):
            system_prompt = extension_prompt if mode == "replace" else "\n\n".join(part for part in (system_prompt, extension_prompt) if part)
        logger.info(
            "🧾 [OpenAI Prompt] target=%s version=%s mode=%s chars=%s sha256=%s "
            "config_prompt=%s ai_policy=%s json_mode=%s",
            self.target,
            (context or {}).get("extension_version", "unknown"),
            mode,
            len(system_prompt or ""),
            _hash(system_prompt or ""),
            bool(extension_prompt),
            "AI DECISION ONLY" in (system_prompt or ""),
            json_mode,
        )
        messages = [{"role": "system", "content": system_prompt or ""}]
        for item in history or []:
            messages.append({"role": "assistant" if item.get("role") == "assistant" else "user", "content": item.get("content", "")})
        messages.append({"role": "user", "content": user_content or ""})

        def call():
            kwargs = {"model": self.model, "messages": messages, "temperature": self.temperature, "timeout": self.timeout}
            if self.model.startswith(("o1", "o3", "gpt-5")):
                kwargs.pop("temperature", None)
                kwargs["max_completion_tokens"] = max_tokens
            else:
                kwargs["max_tokens"] = max_tokens
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            response = self._client().chat.completions.create(**kwargs)
            text = _text(response)
            usage = getattr(response, "usage", None)
            return {
                "reply": text,
                "input_tokens": getattr(usage, "prompt_tokens", 0) if usage else 0,
                "output_tokens": getattr(usage, "completion_tokens", 0) if usage else 0,
                "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
                "model_name": self.model,
                "status": "success" if text else "empty_response",
            }
        return self._cached({"prompt": system_prompt, "message": user_content, "messages": history}, context or {}, call)

    def execute(self, payload, agent=None, user=None, context=None):
        payload = payload or {}
        context = {**(context or {}), "agent": agent, "user": user}
        return self._chat(
            payload.get("system_prompt", payload.get("prompt", "")),
            payload.get("message", ""),
            payload.get("history"),
            json_mode=bool(payload.get("expect_json", False)),
            context=context,
        )


class OpenAIMainAnswerExtension(OpenAIProviderExtension):
    """GPT main-answer adapter with context-aware conversation policy."""

    target = "main-answer-provider"
    feature_summary = (
        "Uses the full conversation, memory and catalog context. It clarifies the "
        "specific product before order collection, keeps image/info replies natural, "
        "and returns to the configured base provider on failure."
    )

    def execute(self, payload, agent=None, user=None, context=None):
        payload = dict(payload or {})
        base_prompt = payload.get("system_prompt", payload.get("prompt", ""))
        extension_prompt = self.config.get("prompt", self.config.get("extension_prompt", ""))
        if self.config.get("override_mode", "append") == "replace":
            composed_prompt = extension_prompt
        else:
            composed_prompt = "\n\n".join(part for part in (base_prompt, extension_prompt) if part)
        payload["system_prompt"] = "\n\n".join(part for part in (composed_prompt, self._conversation_policy()) if part)
        payload["expect_json"] = True
        execution_context = {**(context or {}), "_prompt_precomposed": True}
        logger.info(
            "🧩 [OpenAI Extension] target=main-answer-provider version=%s mode=%s "
            "base_chars=%s extension_chars=%s policy=AI_DECISION_ONLY json_mode=true",
            execution_context.get("extension_version", "unknown"),
            self.config.get("override_mode", "append"),
            len(base_prompt),
            len(extension_prompt),
        )
        logger.info(
            "📝 [OpenAI Extension Prompt] target=main-answer-provider version=%s "
            "configured_prompt=%r built_in_policy=%r",
            execution_context.get("extension_version", "unknown"),
            extension_prompt,
            self._conversation_policy(),
        )
        return super().execute(payload, agent=agent, user=user, context=execution_context)

    @staticmethod
    def _conversation_policy():
        return (
            "CONVERSATION POLICY (AI DECISION ONLY — HIGHER PRIORITY THAN BASE ORDER INSTRUCTIONS):\n"
            "- Infer intent from the current message, complete conversation history, memory, and catalog context.\n"
            "- A catalog retrieval candidate, [CURRENT ACTIVE PRODUCT], recent interest, stored product memory, or an existing ordering state is not by itself proof that the user confirmed that exact product in the current conversation. Do not treat a fuzzy or moderate-confidence match as product confirmation.\n"
            "- If the current message expresses general purchase interest but does not clearly identify one exact product or variant, ask a natural clarification question about which product/design/variant they mean. Do not collect name, phone, address, or quantity yet, and do not set order_intent to create.\n"
            "- If an exact product or variant is explicitly identified by the user and they clearly want that specific item, collect only the next missing order field.\n"
            "- These rules take priority over any base instruction that says to ask for the next missing field when the product is not explicitly confirmed.\n"
            "- Output contract: when order_intent is null, the reply must not ask for customer_name, phone_number, address, quantity, or any other order-collection field.\n"
            "- If the user asks for images, colors, price, details, or availability without clear purchase confirmation, answer that request and do not push order collection.\n"
            "- Do not use fixed replies, keyword matching, or assumptions. Generate the reply in the user's language and conversational tone.\n"
            "- Never invent product, quantity, customer details, or order confirmation."
        )


class OpenAIClassificationExtension(OpenAIProviderExtension):
    target = "classification-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        result = self._chat(payload.get("system_prompt", ""), payload.get("message", ""), payload.get("history"), json_mode=True, max_tokens=1200, context={**(context or {}), "agent": agent})
        try:
            result["data"] = json.loads(result.get("reply") or "{}")
        except (TypeError, ValueError) as exc:
            raise ValueError("OpenAI classification returned invalid JSON") from exc
        return result


class OpenAIMemoryExtension(OpenAIProviderExtension):
    target = "memory-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        result = self._chat(payload.get("system_prompt", ""), payload.get("prompt", payload.get("message", "")), json_mode=True, max_tokens=1200, context={**(context or {}), "agent": agent})
        try:
            result["data"] = json.loads(result.get("reply") or "{}")
        except (TypeError, ValueError) as exc:
            raise ValueError("OpenAI memory extraction returned invalid JSON") from exc
        return result


class OpenAIImageAnalysisExtension(OpenAIProviderExtension):
    target = "image-analysis-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        image = payload.get("image_bytes") or payload.get("image_url")
        if isinstance(image, bytes):
            image = "data:{0};base64,{1}".format(payload.get("mime_type", "image/jpeg"), base64.b64encode(image).decode())
        content = [{"type": "text", "text": payload.get("prompt", "Describe this image accurately.")}, {"type": "image_url", "image_url": {"url": image}}]
        result = self._chat(payload.get("system_prompt", ""), content, context={**(context or {}), "agent": agent})
        return result


class OpenAIImageRerankExtension(OpenAIProviderExtension):
    target = "image-rerank-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        result = self._chat(payload.get("system_prompt", "Return only a JSON array of indices."), payload.get("prompt", json.dumps(payload.get("images", []), ensure_ascii=False)), json_mode=False, max_tokens=300, context={**(context or {}), "agent": agent})
        try:
            result["data"] = json.loads(result["reply"])
            if not isinstance(result["data"], list):
                raise ValueError("rank response is not an array")
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            raise ValueError("OpenAI image rerank returned invalid JSON") from exc
        return result


class OpenAIRAGRerankExtension(OpenAIImageRerankExtension):
    target = "rag-rerank-provider"


# Backward-compatible alias for already registered deployments.
OPAIRerankExtension = OpenAIRAGRerankExtension


class OpenAIPaymentVerificationExtension(OpenAIImageAnalysisExtension):
    target = "payment-verification-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        result = super().execute(payload, agent=agent, user=user, context=context)
        try:
            result["data"] = json.loads(result.get("reply") or "{}")
        except (TypeError, ValueError) as exc:
            raise ValueError("OpenAI payment verification returned invalid JSON") from exc
        return result


class OpenAIAudioTranscriptionExtension(OpenAIProviderExtension):
    target = "audio-transcription-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        def call():
            response = self._client().audio.transcriptions.create(model=self.config.get("transcription_model", "gpt-4o-mini-transcribe"), file=(payload.get("filename", "audio.bin"), payload.get("audio_bytes", b""), payload.get("mime_type", "audio/mpeg")), response_format="text", timeout=self.timeout)
            return {"reply": str(response).strip(), "model_name": self.config.get("transcription_model", "gpt-4o-mini-transcribe"), "status": "success"}
        return self._cached(payload, {**(context or {}), "agent": agent}, call)


class OpenAISummaryExtension(OpenAIProviderExtension):
    target = "summary-provider"


class OpenAICourierParserExtension(OpenAIProviderExtension):
    target = "courier-parser-provider"

    def execute(self, payload, agent=None, user=None, context=None):
        result = self._chat(payload.get("system_prompt", "Extract courier address fields."), payload.get("address", payload.get("message", "")), json_mode=True, max_tokens=500, context={**(context or {}), "agent": agent})
        try:
            result["data"] = json.loads(result.get("reply") or "{}")
        except (TypeError, ValueError) as exc:
            raise ValueError("OpenAI courier parser returned invalid JSON") from exc
        return result


class OpenAIDashboardAssistantExtension(OpenAIProviderExtension):
    target = "dashboard-assistant-provider"
