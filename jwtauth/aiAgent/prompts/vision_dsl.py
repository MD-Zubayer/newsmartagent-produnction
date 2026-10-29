"""
Vision Analysis Protocol DSL Builder
=====================================
Generates structured image-to-text extraction prompts for product catalog embedding and visual search.
Universal compatibility across Gemini Vision, OpenAI GPT-4o Vision, Claude 3.5 Sonnet Vision.
"""

def build_vision_analysis_dsl() -> str:
    """
    Build the universal Vision Analysis Protocol DSL.
    
    Returns:
        Structured XML-Declarative DSL string for vision models.
    """
    return (
        '<image_analysis_protocol version="2.0">\n'
        '  TASK: CATALOG_PRODUCT_FEATURE_EXTRACTION\n'
        '  GOAL: SEARCHABLE_DATABASE_CAPTION\n'
        '  LANGUAGE: ENGLISH\n'
        '\n'
        '  <extraction_targets>\n'
        '    1. category: High-level product category (e.g., Electronics, Clothing, Gadget, Footwear, Home)\n'
        '    2. product_title: Precise product name or item type\n'
        '    3. brand_model: Visible brand name or model number (omit if not visible)\n'
        '    4. color_palette: Primary and secondary colors\n'
        '    5. distinct_feature: Unique visual identifier (texture, pattern, buttons, ports, shape, or logo)\n'
        '  </extraction_targets>\n'
        '\n'
        '  <formatting_constraint>\n'
        '    - Output MUST be a single concise, keyword-dense descriptive sentence.\n'
        '    - DO NOT include conversational filler (e.g., "The image shows", "This is a photo of", "Here is").\n'
        '  </formatting_constraint>\n'
        '</image_analysis_protocol>'
    )
