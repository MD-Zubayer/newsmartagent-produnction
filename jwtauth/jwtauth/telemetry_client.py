import json
import os
import queue
import threading
import urllib.request

_QUEUE = queue.Queue(maxsize=2000)
_STARTED = False
_LOCK = threading.Lock()

def _endpoint(default_endpoint=None):
    if default_endpoint:
        return default_endpoint
    return os.environ.get("MONITORING_TELEMETRY_URL", "")

def _worker():
    while True:
        endpoint, payload = _QUEUE.get()
        try:
            token = os.environ.get("MONITORING_TELEMETRY_TOKEN", "")
            if endpoint and token:
                req = urllib.request.Request(endpoint, data=json.dumps(payload).encode(), method="POST", headers={"Content-Type": "application/json", "X-Monitoring-Token": token})
                urllib.request.urlopen(req, timeout=0.5).read(1)
        except Exception:
            pass
        finally:
            _QUEUE.task_done()

def enqueue_telemetry(payload, endpoint=None):
    global _STARTED
    if not os.environ.get("MONITORING_TELEMETRY_URL") and not endpoint:
        return
    with _LOCK:
        if not _STARTED:
            threading.Thread(target=_worker, name="monitoring-telemetry", daemon=True).start()
            _STARTED = True
    try:
        _QUEUE.put_nowait((_endpoint(endpoint), payload))
    except queue.Full:
        pass

def automation_endpoint():
    configured = os.environ.get("MONITORING_AUTOMATION_TELEMETRY_URL")
    if configured:
        return configured
    base = os.environ.get("MONITORING_TELEMETRY_URL", "")
    return base.replace("/traffic/", "/automation/") if base else ""
