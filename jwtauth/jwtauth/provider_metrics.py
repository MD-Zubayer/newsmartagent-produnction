from contextlib import contextmanager
from time import monotonic
from prometheus_client import Counter, Histogram
from .telemetry_client import enqueue_telemetry, automation_endpoint

PROVIDER_CALLS = Counter("nsa_external_api_calls_total", "External provider calls", ["provider", "operation", "outcome"])
PROVIDER_LATENCY = Histogram("nsa_external_api_duration_seconds", "External provider latency", ["provider", "operation"])
PROVIDER_USAGE = Counter("nsa_ai_requests_total", "AI provider requests", ["provider", "operation", "model", "status"])
PROVIDER_TOKENS = Counter("nsa_ai_tokens_total", "AI provider tokens", ["provider", "operation", "direction"])

@contextmanager
def provider_call(provider, operation):
    started = monotonic()
    outcome = "success"
    try:
        yield
    except Exception:
        outcome = "error"
        raise
    finally:
        PROVIDER_CALLS.labels(str(provider)[:32], str(operation)[:64], outcome).inc()
        PROVIDER_LATENCY.labels(str(provider)[:32], str(operation)[:64]).observe(monotonic() - started)


def record_provider_usage(provider, operation, model="", input_tokens=0, output_tokens=0, status="success", duration_ms=0, estimated_cost=0):
    PROVIDER_USAGE.labels(str(provider)[:32], str(operation)[:64], str(model)[:80], str(status)[:16]).inc()
    PROVIDER_TOKENS.labels(str(provider)[:32], str(operation)[:64], "input").inc(max(0, int(input_tokens or 0)))
    PROVIDER_TOKENS.labels(str(provider)[:32], str(operation)[:64], "output").inc(max(0, int(output_tokens or 0)))
    enqueue_telemetry({"kind": "provider", "name": str(provider)[:32], "provider": str(provider)[:32], "model": str(model)[:80], "operation": str(operation)[:64], "status": status, "duration_ms": duration_ms, "input_tokens": input_tokens, "output_tokens": output_tokens, "estimated_cost": estimated_cost}, automation_endpoint())
