"""Registry for explicitly deployed extension implementations."""
from importlib import import_module


def load_registered(entry_point):
    if not entry_point or ":" not in entry_point:
        return None
    module_name, attribute = entry_point.split(":", 1)
    return getattr(import_module(module_name), attribute)

