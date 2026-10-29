class SafeResponsePostprocess:
    """Example function extension for the ai-response-postprocess hook."""

    def __init__(self, config=None):
        self.config = config or {}

    def execute(self, value, agent=None, context=None):
        if not isinstance(value, dict):
            return value
        value.setdefault("cache_type", "agent_specific")
        value.setdefault("human_handoff", False)
        value.setdefault("image_intent", False)
        value.setdefault("image_ids", [])
        value.setdefault("order_intent", None)
        value.setdefault("order_data", {})
        return value
