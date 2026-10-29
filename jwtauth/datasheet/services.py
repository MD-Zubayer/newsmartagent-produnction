import hashlib
import logging

logger = logging.getLogger('products')

from embedding.models import ProductSearchDocument
from datasheet.text_cleaner import clean_product_description_for_ai


def product_search_text(product):
    variant_lines = []
    for variant in product.variants.all():
        attrs = ", ".join(f"{key}: {value}" for key, value in (variant.attributes or {}).items())
        variant_lines.append(f"Variant {attrs} SKU {variant.sku} Price {variant.price} Stock {variant.stock}")
    attributes = ", ".join(f"{key}: {value}" for key, value in (product.attributes or {}).items())
    clean_desc = clean_product_description_for_ai(product.description)
    return "\n".join(filter(None, [
        f"Product: {product.name}",
        f"Category: {product.category}",
        f"SKU: {product.base_sku}",
        f"Attributes: {attributes}",
        f"Description: {clean_desc}",
        f"Warranty: {product.warranty_information}",
        *variant_lines,
    ]))


def sync_product_search_document(product):
    content = product_search_text(product)
    document, created = ProductSearchDocument.objects.update_or_create(
        product=product,
        defaults={
            "user": product.user,
            "content": content,
            "content_hash": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        },
    )
    logger.info("product_search_document_synced product_id=%s created=%s content_length=%s", product.id, created, len(content))
    return document
