"""
AI Agent Universal Prompt DSL Package
=====================================
Unified, cross-model DSL specifications for Gemini, GPT-4o, Claude 3.5, and Grok.
"""

from aiAgent.prompts.order_protocol_dsl import build_order_protocol_dsl
from aiAgent.prompts.classification_dsl import build_classification_dsl
from aiAgent.prompts.vision_dsl import build_vision_analysis_dsl
from aiAgent.prompts.persona_dsl import build_persona_dsl
from aiAgent.prompts.state_dsl import build_order_state_dsl
from aiAgent.prompts.catalog_dsl import build_catalog_dsl

__all__ = [
    'build_order_protocol_dsl',
    'build_classification_dsl',
    'build_vision_analysis_dsl',
    'build_persona_dsl',
    'build_order_state_dsl',
    'build_catalog_dsl',
]
