import os
import time

import redis
from django.db import connections
from django.http import JsonResponse


def health_view(request):
    """Lightweight liveness + dependency probe."""
    started = time.time()
    checks = {}
    status_code = 200

    # Database check
    try:
        with connections["default"].cursor() as cursor:
            cursor.execute("SELECT 1;")
        checks["database"] = "ok"
    except Exception as exc:  # pragma: no cover - defensive
        status_code = 503
        checks["database"] = str(exc)

    # Redis check (uses REDIS_URL if available)
    try:
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        redis.from_url(redis_url).ping()
        checks["redis"] = "ok"
    except Exception as exc:  # pragma: no cover - defensive
        status_code = 503
        checks["redis"] = str(exc)

    elapsed_ms = round((time.time() - started) * 1000, 2)

    return JsonResponse(
        {
            "status": "ok" if status_code == 200 else "degraded",
            "checks": checks,
            "response_time_ms": elapsed_ms,
        },
        status=status_code,
    )

