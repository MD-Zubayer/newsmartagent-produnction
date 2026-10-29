"""
Agent Persona & Language Mirroring DSL Builder
==============================================
Constructs persona, identity, and linguistic mirroring instructions.
Guarantees consistent persona adherence across Gemini, GPT-4o, Claude 3.5, and Grok.
"""

def detect_language_style(text: str) -> str:
    """Detect writing style: Bangla script, Banglish/Latin, Mixed, or English."""
    value = str(text or "")
    bangla_chars = sum(1 for char in value if "\u0980" <= char <= "\u09ff")
    latin_chars = sum(1 for char in value if "a" <= char.lower() <= "z")
    if bangla_chars and latin_chars:
        return "MIXED_BANGLA_ENGLISH"
    if bangla_chars:
        return "NATIVE_BANGLA_SCRIPT"
    if latin_chars:
        return "BANGLISH_OR_ENGLISH"
    return "DEFAULT"


def build_persona_dsl(agent_name: str, custom_role: str, contact_instructions: str, user_text: str) -> str:
    """
    Build the universal Agent Persona & Language Policy DSL.
    
    Returns:
        Structured XML-Declarative DSL string.
    """
    style = detect_language_style(user_text)
    if style == "MIXED_BANGLA_ENGLISH":
        lang_rule = "The customer used mixed Bangla and English. Reply in the same natural mixed style, preserving English product terms with Bangla grammar."
    elif style == "NATIVE_BANGLA_SCRIPT":
        lang_rule = "Reply entirely in natural Bangla script, matching the customer's polite and warm conversational tone."
    elif style == "BANGLISH_OR_ENGLISH":
        lang_rule = "Reply in the customer's language and writing style (natural Banglish in Latin script or English). Do not force Bangla script if customer writes in Latin letters."
    else:
        lang_rule = "Match customer's language and tone naturally."

    dsl = (
        '<agent_persona_dsl version="2.0">\n'
        f'  IDENTITY: Official AI Sales & Support Assistant for {agent_name or "Merchant"}\n'
        f'  ROLE: {custom_role or "Sales Representative"}\n'
        f'  MERCHANT_DIRECTIVES: {contact_instructions or "Help customer courteously with product inquiries and direct chat orders."}\n'
        '\n'
        '  <language_mirroring_policy>\n'
        f'    RULE: {lang_rule}\n'
        '  </language_mirroring_policy>\n'
        '\n'
        '  <visual_policy>\n'
        '    - Whenever customer asks for photos or expresses intent to see products, set image_intent=true.\n'
        '    - NEVER claim inability to show, send, or attach photos; system delivers visual cards automatically.\n'
        '  </visual_policy>\n'
        '\n'
        '  <service_policy>\n'
        '    - If customer expresses frustration, complaint, or dissatisfaction, respond with calm empathy, sincere respect, and understanding. Reassure them of product quality and merchant authenticity; never send abrupt robotic cancellation messages.\n'
        '  </service_policy>\n'
        '</agent_persona_dsl>'
    )
    return dsl
