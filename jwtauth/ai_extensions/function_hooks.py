import logging
import time

from .models import ExtensionExecutionLog
from .resolver import resolve

logger = logging.getLogger(__name__)


def run_function_override(key, value, agent, user=None, context=None, request_id=""):
    """Run a registered function extension or return the original value."""
    assignment, factory = resolve(key, "function", agent=agent, user=user)
    if not factory:
        return value, None
    started = time.monotonic()
    try:
        extension = factory(assignment.config or assignment.version.default_config or {})
        result = extension.execute(value=value, agent=agent, context=context or {})
        config = assignment.config or assignment.version.default_config or {}
        mode = config.get("override_mode", (assignment.extension.manifest or {}).get("override_mode", "replace"))
        if mode == "append" and isinstance(value, dict) and isinstance(result, dict):
            result = {**value, **result}
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=True, latency_ms=(time.monotonic() - started) * 1000,
            metadata={"target": key},
        )
        return result, assignment.version
    except Exception as exc:
        logger.exception("Function extension failed; using base value")
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=False, latency_ms=(time.monotonic() - started) * 1000,
            error_message=str(exc)[:4000], metadata={"target": key, "fallback": "base"},
        )
        return value, None

