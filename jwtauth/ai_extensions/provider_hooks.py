"""Provider-only extension dispatchers.

Base AI providers remain the fallback. Provider implementations belong in
ai_extensions and are invoked only when an active assignment exists.
"""
import logging
import time
import hashlib
import json

from .models import ExtensionExecutionLog
from .resolver import resolve

logger = logging.getLogger(__name__)


def run_provider_override(key, payload, agent=None, user=None, context=None, request_id="", base_fallback=None):
    """Run an extension-owned provider adapter, otherwise use the base fallback."""
    assignment, factory = resolve(key, "provider", agent=agent, user=user)
    if not factory:
        return base_fallback() if callable(base_fallback) else base_fallback, None

    started = time.monotonic()
    try:
        extension_config = assignment.config or assignment.version.default_config or {}
        extension = factory(extension_config)
        config_hash = hashlib.sha256(json.dumps(extension_config, sort_keys=True, default=str).encode()).hexdigest()[:24]
        execution_context = {**(context or {}), "extension_version": assignment.version.version, "extension_config_hash": config_hash}
        logger.info(
            "🧩 [Provider Extension] executing key=%s version=%s entry_point=%s",
            key, assignment.version.version, assignment.version.entry_point,
        )
        result = extension.execute(
            payload=payload,
            agent=agent,
            user=user,
            context=execution_context,
        )
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown",
            extension=assignment.extension,
            version=assignment.version,
            agent=agent,
            user=user,
            success=True,
            latency_ms=(time.monotonic() - started) * 1000,
            metadata={"target": key, "provider": True, "provider_name": extension_config.get("provider", "openai"), "model": extension_config.get("model", "gpt-4o-mini"), "fallback": False, "tokens": (result or {}).get("total_tokens", 0) if isinstance(result, dict) else 0},
        )
        return result, assignment.version
    except Exception as exc:
        logger.exception("Provider extension %s failed; using base provider", assignment.version)
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown",
            extension=assignment.extension,
            version=assignment.version,
            agent=agent,
            user=user,
            success=False,
            latency_ms=(time.monotonic() - started) * 1000,
            error_message=str(exc)[:4000],
            metadata={"target": key, "provider": True, "fallback": True},
        )
        return base_fallback() if callable(base_fallback) else base_fallback, None
