import re
from decimal import Decimal, InvalidOperation
from typing import Optional

PHONE_PATTERN = re.compile(r'^(?:\+88)?01[3-9]\d{8}$')
QUANTITY_PATTERN = re.compile(r'\b([1-9]\d{0,3})\b')
PRICE_PATTERN = re.compile(r'\b(\d{1,6}(?:\.\d{1,2})?)\b')
QUANTITY_KEYWORDS = [
    'পণ্য', 'আইটেম', 'ডজন', 'unit', 'pcs', 'pieces', 'qty', 'quantity', 'টুকরা', 'খানা'
]


def normalize_numeric_text(text: str) -> str:
    if not text:
        return ''
    return re.sub(r'[^\d+]', '', text)


def validate_phone_number_bd(raw_value: str) -> Optional[str]:
    if not raw_value:
        return None

    candidate = normalize_numeric_text(raw_value)
    if PHONE_PATTERN.match(candidate):
        if candidate.startswith('+88'):
            return candidate[3:]
        return candidate
    return None


def validate_quantity(raw_value: str, context_text: str = '') -> Optional[int]:
    if not raw_value:
        return None

    numbers = [int(match) for match in QUANTITY_PATTERN.findall(raw_value)]
    if not numbers:
        return None

    if len(numbers) == 1:
        return numbers[0]

    text = f"{context_text} {raw_value}".lower()
    for keyword in QUANTITY_KEYWORDS:
        for match in re.finditer(rf'\b([1-9]\d{{0,3}})\b', text):
            num = int(match.group(1))
            window = text[max(0, match.start() - 20):match.end() + 20]
            if keyword in window:
                return num

    return numbers[0]


def validate_price(raw_value: str) -> Optional[Decimal]:
    if not raw_value:
        return None

    clean_value = raw_value.replace(',', '').strip()
    matches = PRICE_PATTERN.findall(clean_value)
    if not matches:
        return None

    try:
        value = Decimal(matches[0])
    except (InvalidOperation, ValueError):
        return None

    if value < Decimal('20') or value > Decimal('500000'):
        return None
    return value
