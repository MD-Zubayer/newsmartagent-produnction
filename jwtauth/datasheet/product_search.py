import hashlib
import json
import logging
import re
from decimal import Decimal, InvalidOperation
from django.db.models import Q
from aiAgent.cache.client import get_redis_client
from aiAgent.models import UserMemory
from datasheet.models import Product, ProductGalleryImage
from embedding.models import ProductSearchDocument
from datasheet.text_cleaner import clean_product_description_for_ai
from embedding.utils import get_gemini_embedding
from pgvector.django import CosineDistance

logger = logging.getLogger("products")
PRODUCT_RESULT_CACHE_TTL = 172800  # 2 days; catalog version invalidates earlier.
PRODUCT_QUERY_EMBEDDING_CACHE_TTL = 86400  # 1 day.
PRODUCT_IMAGE_RESULT_CACHE_TTL = 86400  # 1 day; catalog version invalidates it.
_BN_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
_PUNCT_RE = re.compile(r"[^\w\s\u0980-\u09ff:+.%/-]", re.UNICODE)
_COLOR_MAP = {
    "black": "black", "কালো": "black",
    "white": "white", "সাদা": "white",
    "red": "red", "লাল": "red",
    "blue": "blue", "নীল": "blue",
    "green": "green", "সবুজ": "green",
    "yellow": "yellow", "হলুদ": "yellow",
}

def normalize_product_text(value):
    value = str(value or "").translate(_BN_DIGITS).lower().strip()
    value = value.replace("৳", " taka ").replace("টাকা", " taka ")
    value = _PUNCT_RE.sub(" ", value)
    return " ".join(value.split())

def _number(val):
    try:
        return float(val) if "." in str(val) else int(val)
    except (ValueError, TypeError):
        return None

def extract_product_query(message):
    normalized = normalize_product_text(message)
    query = {"normalized_query": normalized, "category": None, "color": None, "size": None, "min_price": None, "max_price": None, "quantity": 1, "product_terms": normalized}
    if not normalized: return query

    # Remove phone numbers before checking price
    no_phone_text = re.sub(r"(?:\+?88)?01[3-9]\d{8}\b", " ", normalized)

    price_matches = list(re.finditer(r"(?:under|within|below|less than|max|up to|around|প্রায়|মধ্যে|ভিতরে|দাম)\s*(\d+(?:\.\d+)?)", no_phone_text))
    numbers = list(re.finditer(r"\b(\d+(?:\.\d+)?)\b", no_phone_text))
    if price_matches:
        query["max_price"] = _number(price_matches[-1].group(1))
    elif numbers:
        val = _number(numbers[-1].group(1))
        if val and 100 <= val <= 500000 and re.search(r"(?:taka|টাকা|দাম|বাজেট|budget)\s*" + re.escape(str(numbers[-1].group(1))), no_phone_text):
            query["max_price"] = val

    qty = re.search(r"(?:qty|quantity|পরিমাণ|টা|টি|pieces?|পিস)\s*[:=-]?\s*(\d+)", normalized)
    if qty: query["quantity"] = max(1, int(qty.group(1)))
    size = re.search(r"\b(xxs|xs|s|m|l|xl|xxl|xxxl)\b|size\s*[:=-]?\s*(xxs|xs|s|m|l|xl|xxl|xxxl)", normalized)
    if size: query["size"] = next((part for part in size.groups() if part), None)
    for color_word, color_val in _COLOR_MAP.items():
        if color_word in normalized: query["color"] = color_val; break

    query["product_terms"] = normalized
    return query

def _memory(agent, sender_id):
    if not agent or not sender_id: return None
    obj, _ = UserMemory.objects.get_or_create(ai_agent=agent, sender_id=str(sender_id).lower(), defaults={"data": {}})
    return obj

def _variant_matches(variant, query):
    values = " ".join(normalize_product_text(v) for v in (variant.attributes or {}).values())
    return (not query.get("size") or query["size"] in values) and (not query.get("color") or query["color"] in values)

def _price(product): return product.sale_price if product.sale_price is not None else product.base_price

def _serialize(product, query):
    effective_price = _price(product)
    base_price = product.base_price
    sale_price = product.sale_price
    has_offer = bool(
        sale_price is not None
        and base_price is not None
        and sale_price > 0
        and sale_price < base_price
    )
    discount_amount = (base_price - sale_price) if has_offer else Decimal("0.00")
    discount_pct = (
        round(float(discount_amount / base_price * Decimal("100")), 1)
        if has_offer and base_price > 0 else 0.0
    )

    variants = [
        {
            "id": v.id,
            "attributes": v.attributes or {},
            "sku": v.sku,
            "price": str(v.price if v.price is not None else effective_price),
            "stock": float(v.stock),
            "available": float(v.stock) >= query.get("quantity", 1),
        }
        for v in product.variants.all()
    ]
    stock = sum(item["stock"] for item in variants) if variants else float(product.initial_stock)
    clean_desc = clean_product_description_for_ai(product.description)
    has_gallery = product.gallery.filter(processing_status='ready').exists()
    data = {
        "id": product.id,
        "name": product.name,
        "category": product.category,
        "description": clean_desc,
        "price": str(effective_price),
        "regular_price": str(base_price) if base_price is not None else str(effective_price),
        "offer_price": str(sale_price) if has_offer else None,
        "has_offer": has_offer,
        "discount_amount": str(discount_amount) if has_offer else "0.00",
        "discount_percentage": discount_pct if has_offer else 0.0,
        "stock": stock,
        "attributes": product.attributes or {},
        "warranty_information": product.warranty_information,
        "variants": variants,
        "has_images": has_gallery,
    }
    return data

def _cache():
    try: return get_redis_client(db=1)
    except Exception: return None

def invalidate_product_cache(user_id):
    client = _cache()
    if client:
        try:
            version = client.incr(f"product_catalog_version:{user_id}")
            logger.info("product_cache_version_bumped user_id=%s version=%s", user_id, version)
        except Exception as exc: logger.warning("product_cache_invalidation_failed user_id=%s error=%s", user_id, type(exc).__name__)

def _cache_key(user_id, query, sender_id=None):
    client = _cache()
    version = "0"
    if client:
        try:
            raw_version = client.get(f"product_catalog_version:{user_id}")
            version = raw_version.decode() if raw_version else "0"
        except Exception:
            pass
    digest = hashlib.sha256(json.dumps(query, sort_keys=True, default=str).encode()).hexdigest()
    is_contextual = bool(query.get("contextual_policy") or query.get("is_augmented") or query.get("is_continuation"))
    sender_part = f":{sender_id}" if sender_id and is_contextual else ""
    return f"product_search:{user_id}{sender_part}:{version}:{digest}"


def _embedding_cache_key(normalized_query):
    digest = hashlib.sha256(normalized_query.encode("utf-8")).hexdigest()
    return f"product_query_embedding:{digest}"


def _get_query_embedding(normalized_query, client, debug):
    if not normalized_query:
        return None
    key = _embedding_cache_key(normalized_query)
    if client:
        try:
            raw = client.get(key)
            if raw:
                debug["embedding_cache_hit"] = True
                return json.loads(raw)
        except Exception:
            debug["embedding_cache_read_error"] = True
    debug["embedding_cache_hit"] = False
    try:
        vector = get_gemini_embedding(normalized_query)
        if vector and client:
            client.setex(key, PRODUCT_QUERY_EMBEDDING_CACHE_TTL, json.dumps(vector))
        return vector
    except Exception as exc:
        debug["embedding_error"] = type(exc).__name__
        return None


def search_products(user, message, agent=None, sender_id=None):
    query = extract_product_query(message)
    trace_id = hashlib.sha256(f"{user.id}:{query.get('normalized_query', '')}:{sender_id or ''}".encode('utf-8')).hexdigest()[:16]
    logger.info("product_pipeline stage=structured_query_extracted trace_id=%s user_id=%s query=%s", trace_id, user.id, json.dumps(query, ensure_ascii=False, default=str, sort_keys=True))
    memory = _memory(agent, sender_id)
    last_ids = (memory.data.get("_internal", {}).get("last_viewed_product_ids", []) if memory else []) or []
    original_message = query.get("normalized_query", "")
    recent_interest = (memory.data.get("_internal", {}).get("recent_order_interest", {}) if memory else {}) or {}
    previous_product_name = str(recent_interest.get("product_name") or "").strip()
    if not previous_product_name and last_ids:
        previous_product_name = str(
            Product.objects.filter(user=user, id__in=last_ids[:3], is_archived=False).values_list("name", flat=True).first() or ""
        ).strip()

    active_products = list(
        Product.objects.filter(user=user, status="active", is_archived=False).values_list("name", flat=True)
    )
    prev_tokens = set(normalize_product_text(previous_product_name).split()) if previous_product_name else set()
    other_catalog_tokens = set()
    for name in active_products:
        name_norm = normalize_product_text(name)
        tokens = {t for t in name_norm.split() if len(t) >= 3 and not t.isdigit()}
        other_catalog_tokens.update(tokens - prev_tokens)

    msg_tokens = set(original_message.split())
    mentions_other_product = bool(msg_tokens & other_catalog_tokens)

    if previous_product_name:
        query["contextual_product_name"] = previous_product_name
        query["context_product_ids"] = last_ids[:3]
        query["is_continuation"] = True

    client = _cache()
    key = _cache_key(user.id, query, sender_id=sender_id)
    cache_key_hash = hashlib.sha256(key.encode()).hexdigest()[:12]
    debug = {
        "cache_key_hash": cache_key_hash,
        "result_cache_hit": False,
        "embedding_cache_hit": None,
        "vector_candidate_count": 0,
        "catalog_size": None,
        "trace_id": trace_id,
        "strategy": None,
        "result_cache_ttl_seconds": PRODUCT_RESULT_CACHE_TTL,
        "embedding_cache_ttl_seconds": PRODUCT_QUERY_EMBEDDING_CACHE_TTL,
    }
    if client:
        try:
            raw = client.get(key)
            if raw:
                cached_payload = json.loads(raw)
                debug["result_cache_hit"] = True
                debug["strategy"] = cached_payload.get("mode")
                cached_payload["debug"] = debug
                logger.info("product_search_cache_hit user_id=%s key_hash=%s", user.id, hashlib.sha256(key.encode()).hexdigest()[:12])
                logger.info("product_pipeline stage=structured_result_cache_hit trace_id=%s confidence=%s result_count=%s", trace_id, cached_payload.get("confidence"), cached_payload.get("count"))
                return cached_payload
        except Exception:
            debug["result_cache_read_error"] = True

    base_queryset = Product.objects.filter(user=user, status="active", is_archived=False)
    catalog_size = base_queryset.count()
    debug["catalog_size"] = catalog_size
    logger.info("product_pipeline stage=database_search_started trace_id=%s catalog_size=%s strategy=%s", trace_id, catalog_size, "vector_first" if catalog_size > 200 else "hybrid_vector_sql")
    debug["strategy"] = "vector_first" if catalog_size > 200 else "hybrid_vector_sql"

    vector_scores = {}
    query_vector = _get_query_embedding(query["normalized_query"], client, debug)
    if query_vector:
        try:
            vector_docs = (
                ProductSearchDocument.objects
                .filter(user=user, product__user=user, product__status="active", product__is_archived=False, embedding__isnull=False)
                .annotate(distance=CosineDistance("embedding", query_vector))
                .order_by("distance")[:24]
            )
            vector_scores = {
                doc.product_id: max(0.0, min(1.0, 1.0 - float(doc.distance)))
                for doc in vector_docs
            }
            debug["vector_candidate_count"] = len(vector_scores)
        except Exception as exc:
            debug["vector_error"] = type(exc).__name__
            logger.warning("product_vector_query_failed user_id=%s error=%s", user.id, type(exc).__name__)

    terms = [term for term in query["product_terms"].split() if len(term) >= 2]
    lexical_queryset = base_queryset
    if query.get("max_price") is not None:
        lexical_queryset = lexical_queryset.filter(
            Q(sale_price__lte=query["max_price"]) |
            Q(sale_price__isnull=True, base_price__lte=query["max_price"])
        )
    if terms:
        lexical_query = Q()
        for term in terms:
            lexical_query |= (
                Q(name__icontains=term) |
                Q(category__icontains=term) |
                Q(description__icontains=term) |
                Q(variants__attributes__icontains=term) |
                Q(gallery__image_caption__icontains=term) |
                Q(gallery__alt_text__icontains=term) |
                Q(gallery__image__icontains=term)
            )
        lexical_ids = lexical_queryset.filter(lexical_query).values_list("id", flat=True)[:100]
    else:
        lexical_ids = []

    candidate_ids = set(vector_scores) | set(last_ids) | set(lexical_ids)
    if not candidate_ids and catalog_size <= 200:
        candidate_ids = set(lexical_queryset.values_list("id", flat=True)[:50])
    products = list(
        lexical_queryset.filter(id__in=candidate_ids)
        .prefetch_related("variants", "gallery")
    )

    ranked = []
    normalized_message = query["normalized_query"]
    query_token_set = set(terms)
    exact_name_matches = 0
    for product in products:
        normalized_name = normalize_product_text(product.name)
        name_tokens = set(normalized_name.split())
        searchable = set(
            (normalized_name + " " +
             normalize_product_text(product.category) + " " +
             normalize_product_text(clean_product_description_for_ai(product.description))).split()
        )
        overlap = len(query_token_set & searchable)
        name_token_coverage = (
            len(name_tokens & query_token_set) / len(name_tokens)
            if name_tokens else 0.0
        )
        # Product names must outrank embedding similarity even when the user
        # adds conversational text such as "er price koto".
        exact_name = bool(normalized_name and normalized_name in normalized_message)
        strong_name = exact_name or (len(name_tokens) >= 2 and name_token_coverage >= 0.9)
        if exact_name:
            exact_name_matches += 1
        variants = list(product.variants.all())
        requested = bool(query.get("size") or query.get("color"))
        matching = [variant for variant in variants if _variant_matches(variant, query)]
        available_stock = (
            sum(float(variant.stock) for variant in matching)
            if requested and variants else
            sum(float(variant.stock) for variant in variants) if variants else float(product.initial_stock)
        )
        available = available_stock >= query["quantity"]
        v_score = vector_scores.get(product.id, 0.0)
        if exact_name:
            score = 0.99
        elif strong_name:
            score = 0.96
        elif overlap > 0:
            score = max(min(0.88, 0.45 + 0.12 * overlap), v_score)
        else:
            # Zero token overlap with product or category terms:
            # Only genuine high-similarity embeddings pass; discard background noise (< 0.75)
            score = v_score if v_score >= 0.75 else 0.0

        if requested and not matching:
            score -= 0.15
        ranked.append((score, available, product))

    debug["exact_name_matches"] = exact_name_matches
    ranked.sort(key=lambda item: (item[1], item[0]), reverse=True)
    results = [
        _serialize(item[2], query) |
        {"match_score": round(item[0], 3), "requested_variant_available": item[1]}
        for item in ranked[:8]
    ]
    payload = {
        "query": query,
        "results": results,
        "count": len(results),
        "confidence": results[0]["match_score"] if results else 0.0,
        "mode": "hybrid_vector_sql" if vector_scores else "structured_sql_fallback",
        "debug": debug,
    }
    confidence = results[0]["match_score"] if results else 0.0
    if memory and results and confidence >= 0.60:
        data = memory.data or {}
        internal = data.get("_internal", {})
        internal["last_viewed_product_ids"] = [item["id"] for item in results[:3] if (item.get("match_score") or 0) >= 0.60]
        internal["last_product_query"] = query
        data["_internal"] = internal
        memory.data = data
        memory.save(update_fields=["data"])
    if client and not query.get("skip_cache_write"):
        try:
            client.setex(key, PRODUCT_RESULT_CACHE_TTL, json.dumps(payload, default=str))
        except Exception:
            debug["result_cache_write_error"] = True
    logger.info("product_pipeline stage=database_search_completed trace_id=%s top_product_id=%s top_product_name=%s top_price=%s top_stock=%s top_match_score=%s alternatives=%s result_cache_hit=%s", trace_id, results[0].get("id") if results else None, results[0].get("name") if results else None, results[0].get("price") if results else None, results[0].get("stock") if results else None, results[0].get("match_score") if results else None, [item.get("id") for item in results[1:4]], debug["result_cache_hit"])
    logger.info(
        "product_message_search user_id=%s sender_hash=%s result_count=%s confidence=%s mode=%s "
        "result_cache_hit=%s embedding_cache_hit=%s vector_candidates=%s catalog_size=%s",
        user.id,
        hashlib.sha256(str(sender_id).encode()).hexdigest()[:12] if sender_id else "none",
        len(results),
        payload["confidence"],
        payload["mode"],
        debug["result_cache_hit"],
        debug["embedding_cache_hit"],
        debug["vector_candidate_count"],
        debug["catalog_size"],
    )
    return payload


def search_product_images(user, image_vector, caption_vector=None, message='', top_k=5):
    """Hybrid image/caption search scoped to one merchant's Product gallery."""
    if not user or not image_vector:
        return []

    client = _cache()
    version = "0"
    if client:
        try:
            raw_version = client.get(f"product_catalog_version:{user.id}")
            version = raw_version.decode() if raw_version else "0"
        except Exception:
            pass
    image_hash = hashlib.sha256(json.dumps(image_vector).encode()).hexdigest()
    caption_hash = hashlib.sha256(json.dumps(caption_vector).encode()).hexdigest() if caption_vector else "none"
    message_hash = hashlib.sha256(normalize_product_text(message).encode("utf-8")).hexdigest()[:16]
    cache_key = f"product_image_search:{user.id}:{version}:{image_hash}:{caption_hash}:{message_hash}"
    if client:
        try:
            raw = client.get(cache_key)
            if raw:
                logger.info("product_image_search_cache_hit user_id=%s", user.id)
                return json.loads(raw)
        except Exception:
            logger.warning("product_image_search_cache_read_failed user_id=%s", user.id)

    base = ProductGalleryImage.objects.filter(
        product__user=user,
        product__status="active",
        product__is_archived=False,
        processing_status="ready",
    ).select_related("product", "variant")

    try:
        image_hits = list(
            base.filter(image_embedding__isnull=False)
            .annotate(distance=CosineDistance("image_embedding", image_vector))
            .order_by("distance")[:20]
        )
        caption_hits = []
        if caption_vector:
            caption_hits = list(
                base.filter(caption_embedding__isnull=False)
                .annotate(distance=CosineDistance("caption_embedding", caption_vector))
                .order_by("distance")[:20]
            )
    except Exception as exc:
        logger.warning("product_image_vector_search_failed error=%s", type(exc).__name__)
        return []

    merged = {}
    for hit in image_hits:
        merged.setdefault(hit.id, {"image": hit, "image_score": 0.0, "caption_score": None})
        merged[hit.id]["image_score"] = max(0.0, min(1.0, 1.0 - float(hit.distance)))
    for hit in caption_hits:
        merged.setdefault(hit.id, {"image": hit, "image_score": 0.0, "caption_score": None})
        merged[hit.id]["caption_score"] = max(0.0, min(1.0, 1.0 - float(hit.distance)))

    results = []
    for entry in merged.values():
        hit = entry["image"]
        image_score = entry["image_score"]
        caption_score = entry["caption_score"]
        query_tokens = set(normalize_product_text(message).split())
        searchable = set(normalize_product_text(
            f"{hit.product.name} {hit.product.category} {hit.image_caption} "
            f"{json.dumps(hit.variant.attributes if hit.variant else {}, ensure_ascii=False)}"
        ).split())
        text_relevance = (
            len(query_tokens & searchable) / max(1, len(query_tokens))
            if query_tokens else 0.0
        )
        confidence = (
            image_score * 0.65
            + (caption_score if caption_score is not None else image_score) * 0.20
            + text_relevance * 0.15
        )
        variant = hit.variant
        results.append({
            "image_id": hit.id,
            "product_id": hit.product_id,
            "product_name": hit.product.name,
            "variant_id": hit.variant_id,
            "variant_attributes": variant.attributes if variant else {},
            "image_caption": hit.image_caption or "",
            "image_url": hit.image.url if hit.image else "",
            "image_score": round(image_score, 3),
            "caption_score": round(caption_score, 3) if caption_score is not None else None,
            "distance": round(1.0 - image_score, 6),
            "confidence": round(confidence, 3),
            "image_confidence": round(image_score, 3),
            "text_relevance": round(text_relevance, 3),
        })
    results.sort(key=lambda item: item["confidence"], reverse=True)
    results = results[:max(1, min(int(top_k), 20))]
    if client:
        try:
            client.setex(cache_key, PRODUCT_IMAGE_RESULT_CACHE_TTL, json.dumps(results, ensure_ascii=False))
            logger.info("product_image_search_cache_saved user_id=%s result_count=%s", user.id, len(results))
        except Exception:
            logger.warning("product_image_search_cache_write_failed user_id=%s", user.id)
    return results

def build_product_image_context(user, image_vector, message="", agent=None, sender_id=None):
    hits = search_product_images(user, image_vector, message=message, top_k=5)
    if not hits:
        return "", None

    top = hits[0]
    if top["confidence"] < 0.70:
        logger.info(
            "product_image_match_rejected user_id=%s image_id=%s confidence=%s",
            user.id, top["image_id"], top["confidence"],
        )
        return "", None

    product = Product.objects.filter(
        user=user, id=top["product_id"], status="active", is_archived=False
    ).prefetch_related("variants", "gallery").first()
    if not product:
        return "", None

    variant_text = json.dumps(top["variant_attributes"], ensure_ascii=False)
    context = (
        "\n[PRODUCT IMAGE MATCH - DATABASE AUTHORITATIVE]\n"
        f"Product: {product.name}\n"
        f"Product ID: {product.id}\n"
        f"Matched Image ID: {top['image_id']}\n"
        f"Image Confidence: {top['confidence']:.3f}\n"
        f"Matched Variant ID: {top['variant_id'] or 'general'}\n"
        f"Matched Variant Attributes: {variant_text}\n"
        f"Image Description: {top['image_caption'] or 'not specified'}\n"
        "Use this matched Product as the current image context. Verify live price, stock, "
        "variant and warranty from the Product database. Do not invent missing fields.\n"
    )
    logger.info(
        "product_image_match_selected user_id=%s product_id=%s variant_id=%s image_id=%s confidence=%s",
        user.id, product.id, top["variant_id"], top["image_id"], top["confidence"],
    )
    return context, top



def get_store_category_overview(user, limit=7):
    """
    AI-native compact inventory anchor (~30-50 tokens).
    Gives the LLM instant semantic awareness of what categories, items, and prices exist in the store.
    """
    from collections import defaultdict

    products = list(
        Product.objects.filter(user=user, status="active", is_archived=False)
        .only("id", "name", "category", "base_price", "sale_price")
    )
    if not products:
        return ""

    cat_map = defaultdict(list)
    for p in products:
        raw_cat = (p.category or "").strip() or "General"
        clean_cat = raw_cat.split(">")[-1].strip() if ">" in raw_cat else raw_cat
        cat_map[clean_cat].append(p)

    sorted_cats = sorted(cat_map.items(), key=lambda x: len(x[1]), reverse=True)[:limit]

    cat_items = []
    for cat_name, items in sorted_cats:
        sample_items = []
        for item in items[:4]:
            if item.sale_price and item.base_price and item.sale_price < item.base_price:
                diff = int(item.base_price - item.sale_price)
                sample_items.append(
                    f"{item.name} (Offer: ৳{int(item.sale_price):,}, Reg: ৳{int(item.base_price):,}, ৳{diff:,} Off)"
                )
            else:
                sample_items.append(f"{item.name} (৳{int(item.sale_price or item.base_price or 0):,})")
        cat_items.append(f"{cat_name} ({len(items)} items: {', '.join(sample_items)})")

    return "[STORE ACTIVE INVENTORY]: " + "; ".join(cat_items)


def build_catalog_overview_context(user, message):
    """Delegates to get_store_category_overview."""
    return get_store_category_overview(user, limit=7)


def dynamic_db_product_search(user, query_text):
    """
    Emergency dynamic database product search tool for self-correction.
    Runs direct search on live database and returns concise factual product data.
    """
    if not query_text or not user:
        return "No query provided."
    payload = search_products(user, query_text)
    results = payload.get("results") or []
    if not results:
        return f"No products found in store database matching '{query_text}'."
    top = results[0]
    return f"Verified DB Record: {top['name']} (ID: {top['id']}, Price: ৳{top['price']}, Stock: {top['stock']}, Specs: {top.get('description', '')[:120]})"


def resolve_numbered_selection(agent, sender_id, message_text):
    """
    Detects if the customer message is a numbered selection (e.g., '1', '2', '২', 'number 2', '২ নম্বর')
    referring to a previously listed options list from the assistant.
    Returns the matched Product model instance or None.
    """
    if not message_text or not agent or not sender_id:
        return None

    clean = str(message_text).strip().lower()

    # Map Bengali digits to English
    bn_to_en = {'১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'}
    for bn, en in bn_to_en.items():
        clean = clean.replace(bn, en)

    # Match patterns like "2", "no 2", "2 no", "number 2", "2 number", "2 ta"
    m = re.match(r'^(?:number\s*|no\.?\s*|নম্বর\s*|নং\s*)?([1-9])(?:\s*(?:number|no|নম্বর|নং|ta|টা))?$', clean)
    if not m:
        return None

    selected_num = int(m.group(1))

    # Look back at the last assistant message that contained a numbered list
    try:
        from chat.services import get_last_message
        history = get_last_message(agent, sender_id, limit=6, platform=getattr(agent, 'platform', 'messenger'))
        assistant_msg = None
        for h in reversed(history):
            if h.get('role') in ('assistant', 'model') and re.search(r'\b[1-9][\.\)\-:]\s+', h.get('content', '')):
                assistant_msg = h.get('content')
                break

        if not assistant_msg:
            return None

        # Extract line starting with `{selected_num}.` or `{selected_num})`
        line_match = re.search(rf'(?:^|\n)\s*{selected_num}[\.\)\-:]\s*([^\n—\-]+)', assistant_msg)
        if not line_match:
            return None

        raw_item_name = line_match.group(1).replace('*', '').strip()
        user = getattr(agent, 'user', None)
        if not user:
            return None

        # Try exact / icontains match
        product = Product.objects.filter(user=user, name__icontains=raw_item_name[:20], is_archived=False).first()
        if not product:
            tokens = [t for t in raw_item_name.split() if len(t) >= 3]
            for token in tokens:
                p = Product.objects.filter(user=user, name__icontains=token, is_archived=False).first()
                if p:
                    product = p
                    break

        if product:
            logger.info("product_pipeline stage=numbered_selection_resolved sender_id=%s num=%s product=%s", sender_id, selected_num, product.name)
            return product
    except Exception as e:
        logger.error("Error resolving numbered selection: %s", e)

    return None


def build_product_context(user, message, agent=None, sender_id=None):
    """
    Dual-Track RAG Context Architecture:
    - Layer 1: [ACTIVE CONVERSATION PRODUCT] - Ongoing discussed product from session memory.
    - Layer 2: [SEARCH RESULT FOR USER QUERY] - Real-time vector/lexical search if customer asks for a specific product.
    - Layer 3: [STORE ACTIVE INVENTORY] - Always-present compact store catalog & pricing overview (~40 tokens).
    - Layer 4: Natural conversational directives guiding the LLM without brittle regex gating.
    """
    if not message or not user:
        return ""

    msg_clean = str(message).strip()

    # If the user is submitting checkout details (phone number, address), do not distract with categories
    clean_for_check = re.sub(r"(?:\+?88)?01[3-9]\d{8}", "", msg_clean)
    clean_for_check = re.sub(r"\b(?:phone|mobile|নাম্বার|নম্বর|মোবাইল)\b\s*[:=-]?\s*\d*", "", clean_for_check, flags=re.I)

    has_phone = bool(re.search(r"(?:\+?88)?01[3-9]\d{8}", msg_clean))
    has_checkout = bool(re.search(r"\b(?:ঠিকানা|thikana|address|district|thana|dhaka|chittagong|sylhet|bKash|nagad|নাম|name)\b", msg_clean, re.I))
    if has_phone or has_checkout:
        if not re.search(r"(?:দাম|price|cost|stock|watch|charger|পণ্য|প্রোডাক্ট|আছে|পাব|smartphone|মডেল)", clean_for_check, re.I):
            return ""

    # 1. Store Active Inventory Overview (Always prepared)
    inventory_anchor = get_store_category_overview(user, limit=7)

    # 2. Fetch ongoing conversation product from session memory
    ongoing_product_json = None
    ongoing_product_obj = None
    memory = _memory(agent, sender_id)
    if memory and isinstance(memory.data, dict):
        internal = memory.data.get("_internal", {})
        recent_interest = internal.get("recent_order_interest", {})
        last_ids = internal.get("last_viewed_product_ids", [])
        if recent_interest.get("product_name"):
            ongoing_product_obj = Product.objects.filter(
                user=user, name__iexact=recent_interest["product_name"], status="active", is_archived=False
            ).prefetch_related("variants", "gallery").first()
        if not ongoing_product_obj and last_ids:
            ongoing_product_obj = Product.objects.filter(
                user=user, id__in=last_ids[:3], status="active", is_archived=False
            ).prefetch_related("variants", "gallery").first()

    # 0. Check for numbered list selection (e.g. customer typed "2", "২", "2 no", "number 2")
    is_list_selection = False
    selected_prod_obj = resolve_numbered_selection(agent, sender_id, msg_clean)
    if selected_prod_obj:
        is_list_selection = True
        ongoing_product_obj = selected_prod_obj
        # Update session memory to switch active product
        try:
            from webhooks.tasks import _save_recent_order_interest
            if memory:
                _save_recent_order_interest(
                    memory,
                    product_name=selected_prod_obj.name,
                    price=selected_prod_obj.sale_price or selected_prod_obj.base_price,
                    source_text=msg_clean
                )
        except Exception:
            pass

    if ongoing_product_obj:
        ongoing_product_json = _serialize(ongoing_product_obj, {})

    # 3. Clean search on user's message
    searched_product_json = None
    confidence = 0.0
    if not is_list_selection:
        payload = search_products(user, message, agent=agent, sender_id=sender_id)
        results = payload.get("results") or []
        confidence = payload.get("confidence", 0.0)

        alternatives = []
        if results and confidence >= 0.60:
            top = results[0]
            searched_product_json = top
            alternatives = [
                item for item in results
                if item["id"] != top["id"] and float(item.get("match_score") or 0) >= 0.60
            ][:3]

    # 4. Fetch active storefront promotions/campaigns if any
    active_promotions_list = []
    try:
        from storefront.services.promotion_engine import get_active_promotions_for_merchant
        for p in get_active_promotions_for_merchant(user):
            promo_entry = {
                "title": p.title,
                "type": p.promotion_type,
                "description": p.description or "",
                "is_free_shipping": bool(p.is_free_shipping or p.promotion_type == "free_shipping"),
                "min_order_amount": str(p.min_order_amount) if p.min_order_amount else "0.00",
                "min_quantity": p.min_quantity,
                "discount_percentage": str(p.discount_percentage) if p.discount_percentage else "0.00",
                "discount_amount": str(p.discount_amount) if p.discount_amount else "0.00",
                "coupon_code": p.coupon_code or None,
            }
            active_promotions_list.append(promo_entry)
    except Exception:
        pass

    # Extract delivered image product IDs from session memory
    images_sent_product_ids = []
    if memory and isinstance(memory.data, dict):
        images_sent_product_ids = memory.data.get("_internal", {}).get("images_sent_product_ids", [])

    from aiAgent.prompts.catalog_dsl import build_catalog_dsl
    catalog_dsl_str = build_catalog_dsl(
        active_inventory=inventory_anchor,
        ongoing_product=ongoing_product_json,
        searched_product=searched_product_json,
        confidence=confidence,
        is_list_selection=is_list_selection,
        active_promotions=active_promotions_list,
        images_sent_product_ids=images_sent_product_ids,
    )

    logger.info(
        "product_pipeline stage=dual_track_dsl_attached user_id=%s has_ongoing=%s has_searched=%s is_selection=%s",
        user.id, bool(ongoing_product_json), bool(searched_product_json), is_list_selection
    )
    return catalog_dsl_str
