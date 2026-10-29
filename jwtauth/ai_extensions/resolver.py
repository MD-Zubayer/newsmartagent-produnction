import logging
import time

from .models import ExtensionAssignment, ExtensionExecutionLog
from .registry import load_registered

logger = logging.getLogger(__name__)


def _candidate_assignments(key, agent=None, user=None):
    qs = ExtensionAssignment.objects.select_related("extension", "version").filter(
        extension__key=key,
        extension__is_installed=True,
        extension__is_enabled=True,
        is_enabled=True,
        version__status__in=("stable", "testing"),
    )
    candidates = []
    if user is not None:
        candidates.extend(qs.filter(scope="user", user=user).order_by("priority", "-updated_at"))
    if agent is not None:
        candidates.extend(qs.filter(scope="agent", agent=agent).order_by("priority", "-updated_at"))
    candidates.extend(qs.filter(scope="global").order_by("priority", "-updated_at"))
    return candidates


def resolve(key, target, agent=None, user=None):
    for assignment in _candidate_assignments(key, agent=agent, user=user):
        supported_targets = assignment.version.targets or [assignment.version.target]
        if target not in supported_targets:
            continue
        try:
            factory = load_registered(assignment.version.entry_point)
        except Exception:
            logger.exception("Could not load extension %s", assignment.version)
            continue
        if factory is not None:
            return assignment, factory
    return None, None



def _override_mode(assignment):
    """Return the configured text override mode; append is the safe default."""
    config = assignment.config or {}
    defaults = assignment.version.default_config or {}
    manifest = assignment.extension.manifest or {}
    mode = config.get("override_mode", defaults.get("override_mode", manifest.get("override_mode", "append")))
    return mode if mode in {"append", "replace"} else "append"


def _merge_text_override(base_text, result, assignment):
    if not isinstance(result, str) or not result.strip():
        return base_text
    if _override_mode(assignment) == "replace":
        return result
    # Extensions may return either only the update or the already merged text.
    if result.startswith(base_text):
        return result
    return f"{base_text}\n\n{result}"

def apply_text_override(key, base_text, agent=None, user=None, context=None, request_id=""):
    """Apply a registered text prompt override while preserving base fallback."""
    assignment, factory = resolve(key, "prompt", agent=agent, user=user)
    if not factory:
        return base_text, None
    started = time.monotonic()
    try:
        extension = factory(assignment.config or assignment.version.default_config or {})
        result = extension.apply(
            base_prompt=base_text,
            agent=agent,
            user=user,
            context=context or {},
        )
        result = _merge_text_override(base_text, result, assignment)
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=True, latency_ms=(time.monotonic() - started) * 1000,
            metadata={"target": key},
        )
        return result, assignment.version
    except Exception as exc:
        logger.exception("Text extension %s failed; using base text", assignment.version)
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=False, latency_ms=(time.monotonic() - started) * 1000,
            error_message=str(exc)[:4000], metadata={"target": key, "fallback": "base"},
        )
        return base_text, None

def apply_prompt_override(base_prompt, agent, user=None, context=None, request_id=""):
    """Apply an active prompt extension; otherwise return the untouched base."""
    return apply_text_override(
        "answer-system-prompt", base_prompt, agent=agent, user=user,
        context=context, request_id=request_id,
    )

