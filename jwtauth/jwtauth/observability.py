import os
import uuid
import json
import logging
import re
import hashlib
import hmac
from jwtauth.telemetry_client import enqueue_telemetry, automation_endpoint
from time import monotonic
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest, CollectorRegistry, multiprocess

REQUESTS = Counter("nsa_http_requests_total", "HTTP requests", ["method", "path", "status", "environment"])
DURATION = Histogram("nsa_http_request_duration_seconds", "HTTP request duration", ["method", "path", "environment"])
ACTIVE = Gauge("nsa_http_active_requests", "Active requests", ["environment"])
REQUEST_BYTES = Histogram("nsa_http_request_size_bytes", "HTTP request size", ["path", "environment"])
RESPONSE_BYTES = Histogram("nsa_http_response_size_bytes", "HTTP response size", ["path", "environment"])
BUSINESS_EVENTS = Counter("nsa_business_events_total", "Aggregate business outcomes", ["event", "outcome"])
logger = logging.getLogger("nsa.production.http")

def _user_hash(request):
    user = getattr(request, "user", None)
    identity = str(getattr(user, "pk", "")) if user is not None and getattr(user, "is_authenticated", False) else "anonymous"
    if identity == "anonymous":
        return "anonymous"
    secret = os.environ.get("MONITORING_USER_HASH_SECRET", "change-me")
    return hmac.new(secret.encode(), identity.encode(), hashlib.sha256).hexdigest()[:32]

def _enqueue_traffic(payload):
    enqueue_telemetry(payload)

_DYNAMIC = re.compile(r"/(?:[0-9]+|[0-9a-f]{8}-[0-9a-f-]{27,}|[0-9a-f]{16,})(?=/|$)", re.I)

def normalize_path(path):
    return _DYNAMIC.sub("/:id", path)[:120]

def business_event(path):
    lower = path.lower()
    for key, name in (("login", "login"), ("create_user", "signup"), ("signup", "signup"), ("payment", "payment"), ("chat", "chat"), ("ai", "ai"), ("whatsapp", "whatsapp")):
        if key in lower:
            return name
    return None

class RequestObservabilityMiddleware:
    def __init__(self, get_response): self.get_response = get_response
    def __call__(self, request):
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))[:128]
        request.request_id = rid
        env = os.environ.get("OBSERVABILITY_ENV", "production")
        start = monotonic(); ACTIVE.labels(env).inc(); response = None
        try:
            response = self.get_response(request)
            return response
        finally:
            path = normalize_path(request.path)
            status_code = str(getattr(response, "status_code", 500))
            REQUESTS.labels(request.method, path, status_code, env).inc()
            DURATION.labels(request.method, path, env).observe(monotonic() - start)
            try:
                REQUEST_BYTES.labels(path, env).observe(float(request.META.get("CONTENT_LENGTH", 0)))
                RESPONSE_BYTES.labels(path, env).observe(float(response.get("Content-Length", 0) if response is not None else 0))
            except (TypeError, ValueError):
                pass
            _enqueue_traffic({"route": path, "method": request.method, "status": int(status_code), "duration_ms": round((monotonic() - start) * 1000, 2), "request_bytes": int(request.META.get("CONTENT_LENGTH", 0) or 0), "response_bytes": int(response.get("Content-Length", 0) if response is not None else 0), "user_hash": _user_hash(request)})
            event = business_event(path)
            if event:
                outcome = "success" if status_code.startswith("2") else "failure"
                BUSINESS_EVENTS.labels(event, outcome).inc()
                enqueue_telemetry({"kind": "workflow", "name": event, "status": "success" if outcome == "success" else "error", "duration_ms": round((monotonic() - start) * 1000, 2)}, automation_endpoint())
            logger.info(json.dumps({"level": "info", "service": os.environ.get("OTEL_SERVICE_NAME", "newsmartagent-django"), "request_id": rid, "route": path, "status": int(status_code), "duration_ms": round((monotonic() - start) * 1000, 2)}))
            ACTIVE.labels(env).dec()
            if response is not None: response["X-Request-ID"] = rid

def metrics_view(request):
    from django.http import HttpResponse
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        try:
            multiprocess.MultiProcessCollector(registry)
            payload = generate_latest(registry)
        except (RuntimeError, OSError) as exc:
            # A damaged worker mmap file must not take down the metrics endpoint.
            logger.error("Prometheus multiprocess collection failed: %s", exc)
            payload = b""
    else:
        payload = generate_latest()
    return HttpResponse(payload, content_type=CONTENT_TYPE_LATEST)

def configure_tracing():
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint:
        return
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.instrumentation.django import DjangoInstrumentor
        from opentelemetry.instrumentation.psycopg2 import Psycopg2Instrumentor
        from opentelemetry.instrumentation.redis import RedisInstrumentor
        provider = TracerProvider(resource=Resource.create({"service.name": os.environ.get("OTEL_SERVICE_NAME", "newsmartagent-django"), "deployment.environment": "production"}))
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint, timeout=3)))
        trace.set_tracer_provider(provider)
        DjangoInstrumentor().instrument()
        Psycopg2Instrumentor().instrument()
        RedisInstrumentor().instrument()
    except Exception:
        # Observability must never make the application unavailable.
        pass
