class StrictGroundedPrompt:
    """Example deployed prompt extension; base prompt remains untouched by default."""

    def __init__(self, config=None):
        self.config = config or {}

    def apply(self, base_prompt, agent=None, user=None, context=None):
        instruction = self.config.get(
            "instruction",
            "Use the supplied knowledge context when available. Do not invent prices, stock, policy details, or customer data. If reliable context is missing, say that you are not certain and ask a focused clarification.",
        )
        return f"{base_prompt}\n\n[EXTENSION: STRICT GROUNDED ANSWERS]\n{instruction}"

