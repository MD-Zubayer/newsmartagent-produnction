"""Optional extension points used by the existing AI pipeline."""
import logging
import time

from .models import ExtensionExecutionLog
from .resolver import resolve

logger = logging.getLogger(__name__)


def run_retrieval_override(query, agent, user=None, context=None, request_id=""):
    assignment, factory = resolve("retrieval-strategy", "retrieval", agent=agent, user=user)
    if not factory:
        return None, None
    started = time.monotonic()
    try:
        extension = factory(assignment.config or assignment.version.default_config or {})
        result = extension.retrieve(query=query, agent=agent, context=context or {})
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=True, latency_ms=(time.monotonic() - started) * 1000,
            metadata={"target": "retrieval"},
        )
        return result, assignment.version
    except Exception as exc:
        logger.exception("Retrieval extension failed; using base retrieval")
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=False, latency_ms=(time.monotonic() - started) * 1000,
            error_message=str(exc)[:4000], metadata={"target": "retrieval", "fallback": "base"},
        )
        return None, None


def run_answer_validator(query, answer, context, agent, user=None, request_id=""):
    assignment, factory = resolve("answer-validator", "validator", agent=agent, user=user)
    if not factory:
        return {"accepted": True, "answer": answer, "extension_version": None}
    started = time.monotonic()
    try:
        extension = factory(assignment.config or assignment.version.default_config or {})
        result = extension.validate(query=query, answer=answer, context=context or {}, agent=agent)
        ExtensionExecutionLog.objects.create(
            request_id=request_id or "unknown", extension=assignment.extension, version=assignment.version,
            agent=agent, user=user, success=True, latency_ms=(time.monotonic() - started) * 1000,
            metadata={"target": "validator", "accepted": bool(result.get("accepted", True))},
        )
        return result
    except Exception as exc:
        logger.exception("Validator extension failed; accepting base answer")
        return {"accepted": True, "answer": answer, "extension_version": None, "error": str(exc)}

