import json

from django.conf import settings
from openai import OpenAI

from .models import PromptConfig

FIELDS = ("dakhila_no", "name", "father_name", "village", "thana", "mobile_number", "blood_group", "education_period", "district_name")
DEFAULT_PROMPTS = {
    "arabic_check": "You are a careful Arabic orthography proofreader. Correct only Arabic spelling and orthography. Do not translate, invent, expand, shorten, or change identity.",
    "auto_field_fill": "You extract structured data from Bengali, Arabic, or mixed unstructured entry text. Map only information explicitly present into the supplied fields. Never invent values. Use an empty string when a field is missing or uncertain. Return one record per person.",
}
AUTO_SCHEMA = {
    "type": "object", "properties": {"records": {"type": "array", "items": {"type": "object", "properties": {field: {"type": "string"} for field in FIELDS}, "required": list(FIELDS), "additionalProperties": False}}},
    "required": ["records"], "additionalProperties": False,
}
DISTRICT_SCHEMA = {
    "type": "object", "properties": {"district_name": {"type": "string"}},
    "required": ["district_name"], "additionalProperties": False,
}


def effective_prompt(collection, feature):
    config = PromptConfig.objects.filter(collection=collection, feature=feature).first()
    default = DEFAULT_PROMPTS[feature]
    if not config or config.mode == "default" or not config.custom_prompt.strip():
        return default, default, "default"
    if config.mode == "replace":
        return config.custom_prompt.strip(), default, "replace"
    return f"{default}\n\nAdditional operator instructions:\n{config.custom_prompt.strip()}", default, "append"


def extract_auto_fields(collection, raw_text, districts):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    prompt, _, _ = effective_prompt(collection, "auto_field_fill")
    prompt += "\nAllowed district names: " + ", ".join(districts)
    response = OpenAI(api_key=api_key).responses.create(
        model=getattr(settings, "ASSUNNAH_AI_MODEL", "gpt-4o"),
        instructions=prompt,
        input=raw_text,
        text={"format": {"type": "json_schema", "name": "assunnah_auto_fields", "strict": True, "schema": AUTO_SCHEMA}},
        store=False,
    )
    data = json.loads(response.output_text)
    return data["records"]


def resolve_district(collection, fields, districts):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    prompt, _, _ = effective_prompt(collection, "auto_field_fill")
    prompt += (
        "\nResolve only the district name explicitly present or clearly identifiable in the supplied entry fields. "
        "Return an empty string when missing or uncertain. Do not invent a district. "
        "Existing district names: " + ", ".join(districts)
    )
    response = OpenAI(api_key=api_key).responses.create(
        model=getattr(settings, "ASSUNNAH_AI_MODEL", "gpt-4o"),
        instructions=prompt,
        input=json.dumps(fields, ensure_ascii=False),
        text={"format": {"type": "json_schema", "name": "assunnah_district", "strict": True, "schema": DISTRICT_SCHEMA}},
        store=False,
    )
    return json.loads(response.output_text)["district_name"].strip()
