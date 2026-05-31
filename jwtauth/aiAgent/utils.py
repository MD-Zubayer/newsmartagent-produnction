# aiAgent/utils.py
import re
from difflib import SequenceMatcher

import tiktoken
from aiAgent.models import UserMemory


def count_openai_tokens(text, model="gpt-4o-mini"):

    try:
        encoding = tiktoken.encoding_for_model(model)
        return len(encoding.encode(text))
    except Exception:
        encoding = tiktoken.get_encoding('cl100k_base')
        return len(encoding.encode(text))

def count_gemini_tokens(model_instance, text_or_messages):

    try:
        if isinstance(text_or_messages, list):
            formatted_messages = []
            for m in text_or_messages:
                formatted_messages.append({
                    'role': 'model' if m.get('role') == 'assistant' else 'user',
                    'parts': [{'text':m.get('content', '')}]
                })



        return model_instance.count_tokens(formatted_messages).total_tokens

    except Exception as e:
        print(f'Gemini token count error: {e}')
        return len(text_or_messages) //2  #1/4 of the word as backup (estimate)


# memory helper
def get_memory_context(ai_agent, sender_id):
    try:
        memory = UserMemory.objects.get(ai_agent=ai_agent, sender_id=sender_id)
        info = memory.data

        clean_info = {k: v for k, v in info.items() if v and str(v).lower() != 'unknown' and not k.startswith('_')}

        if not clean_info:
            return ""
        
        # Format as Key: Value pairs for better AI understanding
        formatted_mem = [f"{k.replace('_', ' ').title()}: {v}" for k, v in clean_info.items()]
        return " | ".join(formatted_mem)

    except UserMemory.DoesNotExist:
        return ""


def normalize_order_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def fuzzy_similarity(left, right):
    left_norm = normalize_order_text(left)
    right_norm = normalize_order_text(right)
    if not left_norm or not right_norm:
        return 0.0
    if left_norm == right_norm:
        return 1.0
    if left_norm in right_norm or right_norm in left_norm:
        return 0.92
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def fuzzy_best_match(value, choices, threshold=0.78):
    best_value = None
    best_score = 0.0
    for choice in choices or []:
        score = fuzzy_similarity(value, choice)
        if score > best_score:
            best_value = choice
            best_score = score
    if best_value and best_score >= threshold:
        return {
            "matched": True,
            "value": best_value,
            "score": round(best_score, 3),
        }
    return {
        "matched": False,
        "value": best_value,
        "score": round(best_score, 3),
    }


def extract_catalog_product_names(user, limit=200):
    names = []
    try:
        from embedding.models import SpreadsheetKnowledge, DocumentKnowledge

        product_pattern = re.compile(
            r"\b(?:product|item|brand|name)\s*[:=]\s*([^,;\n]+)",
            re.IGNORECASE,
        )
        knowledge_rows = list(
            SpreadsheetKnowledge.objects.filter(user=user).only("content")[:limit]
        ) + list(
            DocumentKnowledge.objects.filter(user=user).only("content")[:limit]
        )
        for row in knowledge_rows:
            content = str(getattr(row, "content", "") or "")
            for match in product_pattern.finditer(content):
                name = match.group(1).strip()
                if name and name.lower() not in [n.lower() for n in names]:
                    names.append(name)
    except Exception:
        return names
    return names


def extract_known_addresses(user=None, limit=300):
    addresses = []
    try:
        from aiAgent.models import SmartKeyword

        for keyword in SmartKeyword.objects.filter(category="location", is_active=True).values_list("text", flat=True)[:limit]:
            if keyword and keyword.lower() not in [a.lower() for a in addresses]:
                addresses.append(keyword)
    except Exception:
        pass
    return addresses


def normalize_order_entities(user, order_data):
    normalized = dict(order_data or {})
    metadata = {}

    product_name = normalized.get("product_name")
    if product_name:
        product_match = fuzzy_best_match(product_name, extract_catalog_product_names(user))
        if product_match.get("matched"):
            normalized["product_name"] = product_match["value"]
            metadata["product_name"] = {
                "source": "fuzzy_catalog_match",
                "confidence": max(0.8, product_match["score"]),
                "matched_from": product_name,
            }

    address = normalized.get("address")
    if address:
        address_match = fuzzy_best_match(address, extract_known_addresses(user), threshold=0.82)
        if address_match.get("matched"):
            normalized["address"] = address_match["value"]
            metadata["address"] = {
                "source": "fuzzy_location_match",
                "confidence": max(0.78, address_match["score"]),
                "matched_from": address,
            }

    return normalized, metadata
