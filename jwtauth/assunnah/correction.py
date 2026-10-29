import json
import logging

from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)

FIELDS = ("name", "father_name", "village", "thana")

SCHEMA = {
    "type": "object",
    "properties": {
        "corrections": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "name": {"type": "string"},
                    "father_name": {"type": "string"},
                    "village": {"type": "string"},
                    "thana": {"type": "string"},
                    "changed": {"type": "boolean"},
                    "notes": {"type": "string"},
                },
                "required": ["id", "name", "father_name", "village", "thana", "changed", "notes"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["corrections"],
    "additionalProperties": False,
}


def correct_entries(entries):
    api_key = getattr(settings, "OPENAI_API_KEY", "")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")
    payload = [{"id": entry.id, **{field: getattr(entry, field) for field in FIELDS}} for entry in entries]
    client = OpenAI(api_key=api_key)
    response = client.responses.create(
        model=getattr(settings, "ASSUNNAH_AI_MODEL", "gpt-4o-mini"),
        instructions=(
            "You are a careful Arabic orthography proofreader. Correct only Arabic spelling and orthography "
            "in the supplied personal names and places. Do not translate, invent, expand, shorten, or change "
            "the person's identity. Preserve the meaning and all non-Arabic text. Return every input id exactly once. "
            "Do not modify numbers, phone numbers, blood groups, districts, or education years; they are not included."
        ),
        input=json.dumps(payload, ensure_ascii=False),
        text={"format": {"type": "json_schema", "name": "arabic_corrections", "strict": True, "schema": SCHEMA}},
        store=False,
    )
    data = json.loads(response.output_text)
    by_id = {item["id"]: item for item in data["corrections"]}
    if set(by_id) != {entry.id for entry in entries}:
        raise RuntimeError("AI correction response did not contain every entry")
    return by_id
