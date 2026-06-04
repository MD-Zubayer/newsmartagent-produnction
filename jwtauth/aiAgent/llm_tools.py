"""jwtauth/aiAgent/llm_tools.py

Helpers to prepare tool/function schemas for different LLM providers
so the image-delivery tool can be exposed to Gemini, OpenAI, Grok, etc.
"""
from typing import Any, Dict


def get_tools_for_provider(provider: str, tool_definition: Dict[str, Any]):
    """
    Return tools configuration appropriate for the specified provider.

    Args:
        provider: 'gemini' | 'openai' | 'grok' | others
        tool_definition: The generic tool definition produced by
                         `get_image_delivery_tool_definition()`

    Returns:
        A list or structure suitable for passing into the provider SDK.
    """
    provider = (provider or '').lower()

    if provider == 'gemini':
        # Gemini SDK expects tools placed inside the GenerateContentConfig as
        # a list of dictionaries with type/function wrapper used earlier.
        return [{"type": "function", "function": tool_definition}]

    if provider == 'openai' or provider == 'grok':
        # OpenAI's Chat Completions expects a `functions` list.
        # Grok (xAI) may follow similar interface; this provides a compatible
        # functions list. Consumers should map this onto the provider SDK.
        return [tool_definition]

    # Default fallback: return generic list wrapper
    return [{"type": "function", "function": tool_definition}]
