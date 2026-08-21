# aiAgent/business_logic/logic_handler.py
from celery import shared_task
import requests
import re
import os

from aiAgent.models import AgentAI
from chat.services import save_message
from aiAgent.models import AgentAI, MissingRequirement, TokenUsageLog
from aiAgent.memory_service import extract_and_update_memory
from aiAgent.memory_handler import (
    handle_smart_memory_update, 
    get_keywords_by_category, 
    check_keyword_match
)
from aiAgent.models import WebsiteVisitor
from webhooks.constants import TARGET_KEYWORDS
from aiAgent.data_processor import processor_spreadsheet_data
import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import time
from embedding.models import SpreadsheetKnowledge, DocumentKnowledge
from pgvector.django import CosineDistance
from embedding.utils import get_gemini_embedding
from settings.models import AgentSettings
from users.models import OrderForm
import redis
import signal
import logging
import uuid
from django.db.models import F, Sum
from webhooks.utils import fetch_facebook_post_text, get_message_cache, set_message_cache
from chat.utils import get_smart_post_context
from aiAgent.cache.hybrid_similarity import get_cached_reply, set_cached_reply
from aiAgent.cache.ranking import incr_message_frequency
from aiAgent.cache.metrics import incr_counter
import hashlib
from aiAgent.cache.utils import normalize_text
from chat.services import get_last_message
from webhooks.comment import deliver_public_comment_reply
logger = logging.getLogger('aiAgent')

def get_order_instructions(user):
    """
    Fetch any order-specific instructions to enrich RAG/context.
    Fallback: a polite default line.
    """
    try:
        order_instruction = ""
        # Prefer latest OrderForm note if available
        oform = OrderForm.objects.filter(user=user).order_by('-id').first()
        if oform and getattr(oform, 'order_instructions', None):
            order_instruction = oform.order_instructions

        # Fallback to AgentSettings.order_instruction if present
        if not order_instruction:
            settings_obj = AgentSettings.objects.filter(user=user).order_by('-id').first()
            if settings_obj and getattr(settings_obj, 'order_instruction', None):
                order_instruction = settings_obj.order_instruction

        if order_instruction:
            order_instruction = f"{order_instruction}\n\n{_default_direct_order_instructions()}"
        else:
            order_instruction = _default_direct_order_instructions()

        return order_instruction
    except Exception as e:
        logger.error(f"Settings Error while fetching order instructions: {e}")
        return _default_direct_order_instructions()


def _default_direct_order_instructions():
    return (
        "You are a conversational sales assistant for the merchant. "
        "Do not tell customers to use any order form or external link. "
        "If the customer wants to buy, take their order directly in chat. "
        "Collect required customer details in a friendly way: customer_name, phone_number, address, product_name, quantity, and any special instructions. "
        "Do not ask the customer for product price and do not invent price; price must come from the merchant catalog or knowledge base. "
        "Never ask for the same field twice. Always remember details already collected from earlier messages in this conversation. "
        "If the user gives multiple details in one message, use them immediately. "
        "If any required detail is missing, ask only for that missing detail. "
        "ALWAYS return a valid JSON object containing ALL of the following keys in every response: "
        "\"reply\", \"cache_type\", \"human_handoff\", \"order_intent\", \"order_data\", \"image_intent\", and \"image_ids\". "
        "If there is no order intent, set \"order_intent\": null and \"order_data\": {}. "
        "If there is no image request or recommendation, set \"image_intent\": false and \"image_ids\": []. "
        "\"order_intent\" should be \"create\" when the user confirms interest, wants to order, or provides order details. "
        "\"order_data\" should be an object containing customer_name, phone_number, address, district, upazila, and extra_info when available. "
        "Identify and extract the 'district' (district/জেলা name in English) and 'upazila' (upazila/thana name in English) from the customer address or chat text using your knowledge of Bangladesh geography, returning them as separate keys inside 'order_data'. "
        "CRITICAL: For products, \"order_data\" MUST include an \"items\" array. Each element in \"items\" must be an object with \"name\" and \"quantity\". "
        "Example: \"items\": [{\"name\": \"product 1\", \"quantity\": 1}, {\"name\": \"product 2\", \"quantity\": 2}]. "
        "Do not include price unless the user explicitly provided it; backend will merge catalog price. "
        "If the user is confirming details or answering follow-up questions, do not repeat earlier questions. "
        "Keep the reply natural, polite, and simple. "
        "If the user is not placing an order, answer normally."
    )


def perform_rag_search(agent_config, text, post_context_text, order_instruction, existing_vector=None, vector_type='text', image_caption=None, sender_id=None):
    sheet_context = ""
    extra_instruction = ""
    query_vector = existing_vector  # Initialize query_vector for later reuse
    best_hit_row_id = None
    RAG_TOP_K = int(os.getenv('RAG_TOP_K', '5'))
    TOP_K = min(max(3, RAG_TOP_K), 10)
    rag_query = f"{post_context_text} {text}" if post_context_text else text
    try:
        from aiAgent.models import UserMemory
        memory = UserMemory.objects.filter(ai_agent=agent_config, sender_id=str(sender_id).lower()).first()
        if memory and isinstance(memory.data, dict):
            internal = memory.data.get('_internal', {})
            recent_interest = internal.get('recent_order_interest') or {}
            prod_name = recent_interest.get('product_name')
            if prod_name:
                rag_query = f"{rag_query} {prod_name}"
                logger.info(f"✨ Appended recent interest product '{prod_name}' to RAG query. New query: '{rag_query}'")
    except Exception as e:
        logger.error(f"Error appending recent interest to RAG query: {e}")
    
    def _confidence_label(distance):
        if distance is None:
            return "Unknown"
        score = max(0, min(100, int((1.0 - distance) * 100)))
        if score >= 85:
            return f"{score}% (Very High)"
        if score >= 65:
            return f"{score}% (High)"
        if score >= 45:
            return f"{score}% (Moderate)"
        return f"{score}% (Low)"

    def _blend_vectors(vec_a, vec_b, weight_a=0.4, weight_b=0.6):
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return vec_a
        return [weight_a * a + weight_b * b for a, b in zip(vec_a, vec_b)]

    try:
        caption_vector = None
        if vector_type == 'image' and image_caption:
            caption_vector = get_gemini_embedding(image_caption)
            if caption_vector:
                logger.info("📝 Generated caption vector for image caption hybrid search.")
        
        if query_vector and vector_type == 'image' and caption_vector:
            blended_vector = _blend_vectors(query_vector, caption_vector, weight_a=0.6, weight_b=0.4)
            if blended_vector:
                logger.info("🧪 Blended image and caption vectors for hybrid image search.")
                query_vector = blended_vector

        if query_vector and vector_type == 'image':
            logger.info("✅ perform_rag_search received image vector; skipping text embedding generation.")
        elif not query_vector:
            # OPTIMIZATION: Only generate embedding if user has knowledge base
            has_spread_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user).exists()
            has_doc_knowledge = DocumentKnowledge.objects.filter(user=agent_config.user).exists()
            
            if not has_spread_knowledge and not has_doc_knowledge:
                logger.info(f"⏭️ Skipping embedding: User {agent_config.user.email} has no records in Knowledge bases.")
                return "", "Answer naturally using your knowledge.", None, best_hit_row_id

            skip_embedding = False

            # 🔥 CRITICAL: Skip text embedding if message is media-only (placeholder like "[Image received]")
            if text and text.strip().startswith('[') and text.strip().endswith(']'):
                placeholder_types = ['image', 'video', 'audio', 'document', 'media']
                text_lower = text.lower()
                if any(ptype in text_lower for ptype in placeholder_types):
                    skip_embedding = True
                    logger.info(f"🖼️ Skipping text embedding for media placeholder: '{text}' (media-only message detected)")

            if len(text) < 3:
                skip_embedding = True
                logger.info("embedding skipped due to length < 3.")
            else:
                from aiAgent.models import SmartKeyword
                db_skip_keywords = SmartKeyword.objects.filter(category='embedding_skip').values_list('text', flat=True)
                skip_margin = 6
                text_len = len(text)
                for kw in db_skip_keywords:
                    if kw.lower() in text.lower() and abs(text_len - len(kw)) <= skip_margin:
                        skip_embedding = True
                        logger.info(f"Keyword '{kw}' found via substring margin guard. Skipping embedding.")
                        break
        
            if not skip_embedding:
                query_vector = get_gemini_embedding(rag_query)
                logger.info(f"DEBUG: Vector Generated: {True if query_vector else False}")
                try:
                    TokenUsageLog.objects.create(
                        user=agent_config.user,
                        ai_agent=agent_config,
                        sender_id=str(sender_id or 'unknown'),
                        model_name='text-embedding-004',
                        input_tokens=len(rag_query) // 4 if rag_query else 0,
                        output_tokens=0,
                        total_tokens=0,
                        platform=getattr(agent_config, 'platform', 'messenger') or 'messenger',
                        request_type='rag_embedding',
                        success=True if query_vector else False
                    )
                except Exception as log_err:
                    logger.debug(f"Failed to log rag embedding token usage: {log_err}")
        else:
            logger.info(f"✅ Using existing query_vector passed to perform_rag_search (image embedding reuse, skipping text embedding)")

        
        if query_vector:
            # 🔍 Scope Filtering logic:
            # - Global (সব এজেন্ট পাবে)
            # - Agent Specific (শুধু এই নির্দিষ্ট এজেন্ট পাবে)
            
            from django.db.models import Q
            from datasheet.models import Spreadsheet
            from embedding.models import Document
            
            # ১. ভ্যালিড স্প্রেডশিট আইডি বের করা (Scope অনুযায়ী)
            valid_sheet_ids = Spreadsheet.objects.filter(
                user=agent_config.user
            ).filter(
                Q(scope='global') | Q(scope='agent_specific', agent=agent_config)
            ).values_list('id', flat=True)
            
            # ২. ভ্যালিড ডকুমেন্ট আইডি বের করা (Scope অনুযায়ী)
            valid_doc_ids = Document.objects.filter(
                user=agent_config.user
            ).filter(
                Q(scope='global') | Q(scope='agent_specific', agent=agent_config)
            ).values_list('id', flat=True)

            # Search Spreadsheet Knowledge (Row IDs Prefix filtering)
            # SpreadsheetKnowledge-এর row_id ফর্মেট: "sheet_{id}_row_{r_idx}"
            sheet_query = Q()
            for s_id in valid_sheet_ids:
                sheet_query |= Q(row_id__startswith=f"sheet_{s_id}_")

            search_hits = []
            if valid_sheet_ids:
                if query_vector and vector_type == 'image':
                    image_sheets = SpreadsheetKnowledge.objects.filter(
                        user=agent_config.user
                    ).filter(sheet_query).annotate(
                        distance=CosineDistance('image_embedding', query_vector)
                    ).filter(distance__lt=0.65).order_by('distance')[:TOP_K]
                    for row in image_sheets:
                        search_hits.append({
                            'row_id': row.row_id,
                            'content': row.content,
                            'distance': float(row.distance),
                            'source_label': 'Spreadsheet Image',
                            'confidence': _confidence_label(float(row.distance))
                        })


                if caption_vector is not None:
                    caption_sheets = SpreadsheetKnowledge.objects.filter(
                        user=agent_config.user
                    ).filter(sheet_query).annotate(
                        distance=CosineDistance('embedding', caption_vector)
                    ).filter(distance__lt=0.65).order_by('distance')[:TOP_K]
                    for row in caption_sheets:
                        search_hits.append({
                            'row_id': row.row_id,
                            'content': row.content,
                            'distance': float(row.distance),
                            'source_label': 'Spreadsheet Caption',
                            'confidence': _confidence_label(float(row.distance))
                        })

                if vector_type != 'image' and query_vector:
                    text_sheets = SpreadsheetKnowledge.objects.filter(
                        user=agent_config.user
                    ).filter(sheet_query).annotate(
                        distance=CosineDistance('embedding', query_vector)
                    ).filter(distance__lt=0.65).order_by('distance')[:TOP_K]
                    for row in text_sheets:
                        search_hits.append({
                            'row_id': row.row_id,
                            'content': row.content,
                            'distance': float(row.distance),
                            'source_label': 'Spreadsheet Text',
                            'confidence': _confidence_label(float(row.distance))
                        })

                related_docs = DocumentKnowledge.objects.none()
                if vector_type != 'image':
                    related_docs = DocumentKnowledge.objects.filter(
                        user=agent_config.user,
                        document_id__in=valid_doc_ids
                    ).select_related('document').annotate(
                        distance=CosineDistance('embedding', query_vector)
                    ).filter(distance__lt=0.65).order_by('distance')[:TOP_K]
                elif caption_vector is not None:
                    related_docs = DocumentKnowledge.objects.filter(
                        user=agent_config.user,
                        document_id__in=valid_doc_ids
                    ).select_related('document').annotate(
                        distance=CosineDistance('embedding', caption_vector)
                    ).filter(distance__lt=0.65).order_by('distance')[:TOP_K]

                for doc in related_docs:
                    title = doc.document.title if doc.document else doc.doc_title
                    search_hits.append({
                        'row_id': f"doc_{doc.id}",
                        'content': doc.content,
                        'distance': float(doc.distance),
                        'source_label': f"Document - {title}",
                        'confidence': _confidence_label(float(doc.distance))
                    })

            # Fallback/Additional search: perform word-based icontains search in database
            # This guarantees that if the user names a product, we will fetch the row even if the vector similarity is low!
            words = [w.strip() for w in re.split(r'[\s,.\-\?\!]+', text) if len(w.strip()) >= 3]
            fallback_query = Q()
            for w in words:
                # Check if word is not a common question word
                if w.lower() not in ['koto', 'dam', 'how', 'much', 'price', 'what', 'please', 'know', 'info', 'price?', 'কত', 'দাম', 'কত?', 'টাকা', 'হবে']:
                    fallback_query |= Q(content__icontains=w)
                    
            if fallback_query and valid_sheet_ids:
                fallback_hits = SpreadsheetKnowledge.objects.filter(
                    user=agent_config.user
                ).filter(sheet_query).filter(fallback_query)[:TOP_K]
                
                existing_row_ids = {h['row_id'] for h in search_hits}
                for row in fallback_hits:
                    if row.row_id not in existing_row_ids:
                        search_hits.append({
                            'row_id': row.row_id,
                            'content': row.content,
                            'distance': 0.05,  # Give it a very high priority (low distance)
                            'source_label': 'Spreadsheet Keyword Fallback',
                            'confidence': '100% (Keyword Match)'
                        })

            unique_hits = {}
            for hit in search_hits:
                existing = unique_hits.get(hit['row_id'])
                if not existing or hit['distance'] < existing['distance']:
                    unique_hits[hit['row_id']] = hit

            ordered_hits = sorted(unique_hits.values(), key=lambda x: x['distance'])
            overall_best_dist = ordered_hits[0]['distance'] if ordered_hits else 1.0

            MIN_MATCH_DISTANCE = 0.85
            filtered_hits = []
            for hit in ordered_hits[:TOP_K]:
                if hit['distance'] >= MIN_MATCH_DISTANCE:
                    logger.info(f"⚠️ Skipping low-confidence hit: {hit['row_id']} distance={hit['distance']:.4f}")
                    continue
                filtered_hits.append(hit)

            # 🔍 AMBIGUITY DETECTION + TWO-STAGE RANKING
            # 1) If top vs second gap > 5% -> hard-filter to top only
            # 2) If gap <= 5% -> apply a semantic Gemini-based reranker to resolve color/variant details
            def _ai_semantic_rerank(query_text, candidate_hits, config):
                if not query_text or not candidate_hits:
                    return candidate_hits
                
                try:
                    from django.conf import settings
                    from google import genai
                    from google.genai import types
                    import json
                    import re
                    
                    if not getattr(settings, 'GEMINI_API_KEY', None):
                        return candidate_hits
                        
                    client = genai.Client(api_key=settings.GEMINI_API_KEY)
                    
                    # Prepare candidate text descriptions for the prompt
                    candidates_str = ""
                    for idx, h in enumerate(candidate_hits):
                        candidates_str += f"{idx}: [Row ID: {h['row_id']}] {h['content']}\n"
                        
                    prompt = (
                        "You are a semantic product search ranker. The customer is asking for a product matching this query:\n"
                        f"Customer Query: \"{query_text}\"\n\n"
                        "Here are the product candidate descriptions from our catalog database:\n"
                        f"{candidates_str}\n"
                        "Task: Select and rank all the candidate Row IDs that are a valid match for the customer's request, from best match to worst match.\n"
                        "CRITICAL: Pay extremely close attention to specific color variants (e.g., if query is 'black shirt', prioritize pure black shirt over white shirt with black stripes).\n"
                        "Return ONLY a valid JSON list of matched Row IDs in ranked order. Example:\n"
                        "[\"sheet_63_row_5\", \"sheet_63_row_2\"]\n"
                        "Do not return any extra explanation, markdown fences, or text outside the JSON list."
                    )
                    
                    # Call Gemini
                    response = client.models.generate_content(
                        model='gemini-3.1-flash-lite',
                        contents=[types.Content(role='user', parts=[types.Part.from_text(text=query_text)])],
                        config=types.GenerateContentConfig(system_instruction=prompt)
                    )
                    
                    try:
                        input_tok = response.usage_metadata.prompt_token_count if hasattr(response, 'usage_metadata') else 400
                        output_tok = response.usage_metadata.candidates_token_count if hasattr(response, 'usage_metadata') else 30
                        # Log token usage for admin panel
                        TokenUsageLog.objects.create(
                            user=config.user,
                            ai_agent=config,
                            sender_id=str(sender_id or 'unknown'),
                            model_name='gemini-3.1-flash-lite',
                            input_tokens=input_tok,
                            output_tokens=output_tok,
                            total_tokens=0,
                            platform=getattr(config, 'platform', 'messenger') or 'messenger',
                            request_type='semantic_rerank',
                            success=True
                        )
                    except Exception as log_err:
                        logger.debug(f"Failed to log rerank token usage: {log_err}")
                    
                    reply = response.text.strip() if response.text else ""
                    logger.info(f"🔮 [Reranker Raw Response]: {reply}")
                    json_match = re.search(r'\[[^\[\]]*\]', reply)
                    if json_match:
                        ordered_ids = json.loads(json_match.group())
                        if isinstance(ordered_ids, list) and ordered_ids:
                            # Reorder candidate_hits based on ordered_ids
                            id_to_hit = {h['row_id']: h for h in candidate_hits}
                            sorted_hits = []
                            for r_id in ordered_ids:
                                if r_id in id_to_hit:
                                    hit_item = id_to_hit.pop(r_id)
                                    # Adjust distance/score to reflect the ranked order
                                    hit_item['adjusted_distance'] = 0.05 + (0.50 * len(sorted_hits))
                                    hit_item['lexical_sim'] = 1.0 - hit_item['adjusted_distance']
                                    sorted_hits.append(hit_item)
                                    
                            # Discard remaining unmatched hits (since AI reranker determined they are not valid matches)
                            pass
                                
                            logger.info(f"🔮 AI Semantic Reranking ordered: {[h['row_id'] for h in sorted_hits]}")
                            return sorted_hits
                except Exception as ex:
                    logger.warning(f"⚠️ AI semantic rerank failed: {ex}")
                return candidate_hits

            is_ambiguous_match = False
            ambiguity_warning = ""
            # compute initial human-friendly scores
            if len(filtered_hits) >= 2:
                score1 = max(0, min(100, int((1.0 - filtered_hits[0]['distance']) * 100)))
                score2 = max(0, min(100, int((1.0 - filtered_hits[1]['distance']) * 100)))
                score_diff = abs(score1 - score2)

                # Hard filter: if top is clearly ahead, keep only the top match
                if score_diff > 10:
                    logger.info(f"🔒 Top match ahead by {score_diff}%. Hard-filtering to top match {filtered_hits[0]['row_id']}")
                    filtered_hits = [filtered_hits[0]]
                else:
                    # Apply semantic reranker using image_caption (preferred) or the incoming text
                    rerank_basis = image_caption or text or post_context_text or ""
                    if rerank_basis:
                        filtered_hits = _ai_semantic_rerank(rerank_basis, filtered_hits, agent_config)

                        # re-evaluate gap after rerank
                        if len(filtered_hits) >= 2:
                            score1_r = max(0, min(100, int((1.0 - filtered_hits[0].get('adjusted_distance', filtered_hits[0]['distance'])) * 100)))
                            score2_r = max(0, min(100, int((1.0 - filtered_hits[1].get('adjusted_distance', filtered_hits[1]['distance'])) * 100)))
                            score_diff_r = abs(score1_r - score2_r)
                            logger.info(f"🔁 Post-rerank score gap: {score_diff_r}% (before: {score_diff}%)")
                            if score_diff_r > 10:
                                logger.info(f"🔒 Reranker resolved ambiguity; selecting top {filtered_hits[0]['row_id']}")
                                filtered_hits = [filtered_hits[0]]
                            else:
                                is_ambiguous_match = True
                        else:
                            # only one candidate after rerank
                            pass
                    else:
                        is_ambiguous_match = True

            # If product is already in memory, bypass ambiguity and filter hits to keep only the one matching the memory product name
            product_already_in_memory = False
            memory_product_name = None
            if sender_id:
                try:
                    from aiAgent.models import UserMemory
                    memory = UserMemory.objects.filter(ai_agent=agent_config, sender_id=str(sender_id).lower()).first()
                    if memory and isinstance(memory.data, dict):
                        internal = memory.data.get('_internal', {})
                        order_fields = internal.get('order_fields', {})
                        prod_data = order_fields.get('product_name', {})
                        if prod_data.get('value') and prod_data.get('confidence', 0.0) >= 0.75:
                            memory_product_name = str(prod_data.get('value')).strip().lower()
                            product_already_in_memory = True
                except Exception:
                    pass

            if product_already_in_memory and memory_product_name:
                from aiAgent.utils import extract_catalog_product_names
                all_catalog_products = extract_catalog_product_names(agent_config.user)
                user_asking_different_product = False
                text_lower = text.lower()
                for p_name in all_catalog_products:
                    p_name_clean = p_name.strip().lower()
                    if p_name_clean != memory_product_name and p_name_clean in text_lower:
                        user_asking_different_product = True
                        break
                
                if not user_asking_different_product:
                    exact_hits = []
                    for h in filtered_hits:
                        content_lower = h['content'].lower()
                        if memory_product_name in content_lower:
                            exact_hits.append(h)
                    if exact_hits:
                        filtered_hits = exact_hits
                        is_ambiguous_match = False

            # Check if user query contains any product catalog keywords
            from aiAgent.utils import extract_catalog_product_names
            all_catalog_products = extract_catalog_product_names(agent_config.user)
            query_contains_product_kw = False
            text_lower = text.lower()
            for p_name in all_catalog_products:
                p_name_clean = p_name.strip().lower()
                words = [w for w in p_name_clean.split() if len(w) >= 3]
                if p_name_clean in text_lower or any(w in text_lower for w in words):
                    query_contains_product_kw = True
                    break

            # Lock product context based on conversation history if query is generic
            recent_product_lock = None
            if sender_id and not query_contains_product_kw:
                try:
                    from chat.models import Conversation
                    convo = Conversation.objects.filter(agentAi=agent_config, contact_id=str(sender_id).strip()).first()
                    if convo:
                        recent_msgs = list(convo.messages.exclude(content__startswith='[System:').order_by('-id')[:4])
                        for msg in recent_msgs:
                            msg_content_lower = msg.content.lower()
                            for p_name in all_catalog_products:
                                p_name_clean = p_name.strip().lower()
                                if p_name_clean in msg_content_lower:
                                    recent_product_lock = p_name_clean
                                    break
                            if recent_product_lock:
                                break
                except Exception as hist_err:
                    logger.debug(f"History product extraction failed: {hist_err}")

            if recent_product_lock:
                logger.info(f"🔒 Locking RAG hits to product from recent history: '{recent_product_lock}'")
                history_hits = []
                for h in filtered_hits:
                    content_lower = h['content'].lower()
                    if recent_product_lock in content_lower:
                        history_hits.append(h)
                if history_hits:
                    filtered_hits = history_hits
                    is_ambiguous_match = False

            if filtered_hits:
                top_hit = filtered_hits[0]
                if isinstance(top_hit.get('row_id'), str) and top_hit['row_id'].startswith('sheet_'):
                    best_hit_row_id = top_hit['row_id']
                    logger.info(f"✅ Best RAG row candidate for image delivery: {best_hit_row_id}")

            matched_content = []
            if is_ambiguous_match:
                if not query_contains_product_kw:
                    is_ambiguous_match = False

            if is_ambiguous_match:
                ambiguity_warning = (
                    "[⚠️ CRITICAL SYSTEM NOTE - READ FIRST]:\n"
                    "The image search returned multiple close matches; please ask the user to clarify which product they mean.\n"
                )
                matched_content.append(ambiguity_warning)

            filtered_hits = filtered_hits[:3]
            for hit in filtered_hits:
                # show lexical sim when available for easier debugging
                lex_info = f" (lex:{hit.get('lexical_sim'):.2f})" if hit.get('lexical_sim') is not None else ""
                # ── Image Match Rate ──
                # Use adjusted_distance (post-rerank) if available, otherwise raw distance
                effective_dist = hit.get('adjusted_distance', hit['distance'])
                image_match_rate = max(0, min(100, round((1.0 - effective_dist) * 100)))
                logger.debug(f"📊 [ImageMatchRate] row={hit['row_id']} dist={effective_dist:.4f} → {image_match_rate}%")

                row_images_info = ""
                try:
                    from embedding.models import RowImage
                    r_id = hit.get('row_id')
                    if r_id and isinstance(r_id, str) and r_id.startswith('sheet_'):
                        row_imgs = list(RowImage.objects.filter(user=agent_config.user, row_id=r_id).order_by('position'))
                        if row_imgs:
                            prod_name = "this product"
                            content_parts = hit['content'].split(',')
                            for part in content_parts:
                                if 'product name:' in part.lower():
                                    prod_name = part.split(':', 1)[1].strip()
                                    break
                            
                            img_descs = [
                                f"[ID: {img.id}] [Spreadsheet Product: '{prod_name}'] | [Image Visual Description: '{img.image_caption or 'No description'}']"
                                for img in row_imgs
                            ]
                            row_images_info = f"\n  📷 Available Image Attachments for {r_id}: " + ", ".join(img_descs)
                except Exception as ex:
                    logger.debug(f"RowImage fetch for context failed: {ex}")

                matched_content.append(
                    f"[Source: {hit['source_label']}] {hit['content']} | Match Confidence: {hit['confidence']}{lex_info} | Image Match Rate: {image_match_rate}%{row_images_info}"
                )

            if matched_content:
                unique_content = list(dict.fromkeys(matched_content))
                
                clean_data = ""
                if best_hit_row_id:
                    clean_data += "\n[CURRENT ACTIVE PRODUCT]\n" + "\n".join(unique_content)
                else:
                    clean_data += "\n" + "\n".join(unique_content)
                
                similar_products_context = ""
                recommendation_policy = ""
                if best_hit_row_id:
                    try:
                        from embedding.models import RowSimilarity, RowImage
                        sims = RowSimilarity.objects.filter(user=agent_config.user, source_row_id=best_hit_row_id).order_by('distance')[:2]
                        sim_lines = []
                        for idx, sim in enumerate(sims, start=1):
                            target_knowledge = SpreadsheetKnowledge.objects.filter(user=agent_config.user, row_id=sim.target_row_id).first()
                            if target_knowledge:
                                content = target_knowledge.content
                                parts = [p.strip() for p in content.split(',') if p.strip()]
                                p_name, p_price, p_discount = None, None, None
                                for part in parts:
                                    if ':' in part:
                                        k, v = part.split(':', 1)
                                        k_clean = k.strip().lower()
                                        v_clean = v.strip()
                                        if 'product name' in k_clean:
                                            p_name = v_clean
                                        elif 'price' in k_clean and 'discount' not in k_clean and 'dicount' not in k_clean:
                                            p_price = v_clean
                                        elif 'discount' in k_clean or 'dicount' in k_clean:
                                            p_discount = v_clean
                                if p_name:
                                    price_str = f"Price: {p_price}" if p_price else "Price: N/A"
                                    if p_discount:
                                        price_str += f" (Discount: {p_discount})"
                                    
                                    target_imgs = list(RowImage.objects.filter(user=agent_config.user, row_id=sim.target_row_id).order_by('position'))
                                    img_ids_str = f"[{', '.join([str(img.id) for img in target_imgs])}]" if target_imgs else "[]"
                                    
                                    sim_lines.append(f"{idx}. Product: {p_name} | {price_str} | Image IDs: {img_ids_str}")
                        
                        if sim_lines:
                            similar_products_context = (
                                "\n\n[SIMILAR/ALTERNATIVE PRODUCTS FOR RECOMMENDATION]"
                                "\n" + "\n".join(sim_lines)
                            )
                            
                            recommendation_policy = (
                                "\n\n[AI Product Recommendation Policy]:"
                                "\n- If the customer is actively discussing, inquiring about, or ordering the [CURRENT ACTIVE PRODUCT], do NOT proactively recommend or list other products. Focus solely on answering their query or finalizing their order."
                                "\n- You MUST only suggest or list the [SIMILAR/ALTERNATIVE PRODUCTS FOR RECOMMENDATION] when:"
                                "\n  1. The customer explicitly asks for recommendations, other options, colors, styles, or alternatives."
                                "\n  2. The [CURRENT ACTIVE PRODUCT] is out of stock or unavailable."
                                "\n  3. There is a design/style mismatch with the image provided by the user."
                            )
                    except Exception as sim_err:
                        logger.debug(f"RowSimilarity context retrieval failed: {sim_err}")

                # Inject AI instruction about Direct Image ID selection (optimized for tokens)
                image_rate_rule = (
                    "\n[Direct Image ID Selection Policy]:"
                    "\n- If photos requested/similar product matched, check 'Available Image Attachments' for Image IDs and descriptions."
                    "\n- If match found, set 'image_intent': true and include Image IDs in 'image_ids' (e.g., [901])."
                    "\n- If the user asks to see photos/images of the product (including asking for different colors, styles, designs, or all options), you MUST check all 'Available Image Attachments' for that product, set 'image_intent': true, and include the Image IDs of ALL available variants (colors/styles/images) in 'image_ids'. Tell the user what options are available based on the visual descriptions. If a specific variant, color, or style is requested and it is not in the attachments, set 'image_intent': false, 'image_ids': [], state that it is unavailable, and list what other variants/colors/styles are available in the attachments."
                    "\n- CRITICAL: All images listed under 'Available Image Attachments for sheet_X_row_Y' belong to that product row. Even if the image caption describes it as something else (e.g. 'Men's Dress Shirt' or 'Men's Kurta'), they are correct images representing the various colors, styles, or designs of that product. You MUST treat them as variants/images of that product and send them when requested."
                    "\n- CRITICAL: Do NOT print raw ID/caption texts verbatim. Describe features naturally in Bengali."
                    "\n- CRITICAL: Spreadsheet Product name is the main authority. Describe images as that product variant (e.g. 'এখানে [Product Name] এর সাদা রঙের ছবি দেওয়া হলো।')."
                    "\n- CRITICAL (Visual Check - ALWAYS PERFORM THIS): If the user uploaded an image/screenshot (either in the current message as [Image: ...] or as a recently sent image in the conversation history that we are discussing), you MUST compare that image description/caption with the 'Available Image Attachments' captions. If details differ (collar patterns, cuffs, prints, borders) despite being the same color, you MUST state the mismatch first (e.g. 'আপনার ছবির সাথে ডিজাইনে কিছুটা অমিল আছে। আমাদের স্টকে থাকা পাঞ্জাবির ডিজাইন হলো: [আমাদের প্রোডাক্টের বিবরণ]।') AND immediately set 'image_intent': true and include the Image IDs of our correct version and/or the [SIMILAR/ALTERNATIVE PRODUCTS FOR RECOMMENDATION] in 'image_ids' so the user receives the correct/alternative product images in the chat instantly. Never ignore the design mismatch of the discussed image under any circumstances."
                    "\n- CRITICAL: If the user uploaded an image/screenshot recently, they have already seen it. Do NOT ask if they want to 'see' it. Ask if they want to order it ('অর্ডার করতে চান?')."
                )
                sheet_context = f"\n[KNOWLEDGE BASE DATA]:\n{clean_data}{similar_products_context}{image_rate_rule}{recommendation_policy}"
                post_info = f"User commented on this post: '{post_context_text}'. " if post_context_text else ""

                if is_ambiguous_match:
                    extra_instruction = f"""
                    ⚠️ INSTRUCTION: The knowledge base has returned multiple close product matches.
                    You should NOT arbitrarily pick one product on behalf of the user.
                    Instead, list the matching products from [KNOWLEDGE BASE DATA] and politely ask the user to specify the exact model/variant.
                    Be friendly and natural, like: "আমাদের কাছে কয়েকটি মডেল আছে: [list]. আপনি কোনটি চাইছেন?"
                    
                    IMPORTANT: While asking for product clarification, you CAN and SHOULD still collect other order details 
                    (customer_name, phone_number, address) if the user has expressed clear order intent.
                    Do NOT block the entire order flow just because the product needs clarification.
                    Once the user clarifies the product, proceed with the order normally.
                    {order_instruction}
                    """
                    logger.info(f">>> AMBIGUOUS RAG MATCH! Asking AI to clarify with user while continuing order flow.")
                elif filtered_hits and len(filtered_hits) == 1 and (1.0 - filtered_hits[0].get('adjusted_distance', filtered_hits[0]['distance'])) > 0.55:
                    # strong single match after filtering/rerank
                    extra_instruction = f"""
                            {post_info}  strictly using only the content inside [KNOWLEDGE BASE DATA].
                            Keep it short, clear, friendly, natural, conversational..
                            No markdown, no bold text, no formatting.
                            If appropriate, end with a short, warm follow-up question that encourages the user to continue.
                            {order_instruction}
                            """
                    logger.info(f">>> Strong RAG Match after rerank! selected distance: {filtered_hits[0].get('adjusted_distance', filtered_hits[0]['distance'])}")
                else:
                    extra_instruction = f"""
                    You may use [KNOWLEDGE BASE DATA] if relevant.
                    If not, answer politely using your knowledge.
                    {order_instruction}
                    """
                    logger.info(f">>> Weak or multiple RAG Match! overall_best_dist: {overall_best_dist}")
            else:
                sheet_context = ""
                extra_instruction = f"""
                Answer naturally using your knowledge.
                If unsure, politely ask for clarification.
                {order_instruction}
                """
                logger.info(f">>> No useful RAG match. overall best distance: {overall_best_dist}")
        else:
            extra_instruction = f"""
            Answer naturally using your knowledge.
            {order_instruction}
            """
            logger.info(">>> Embedding skipped due to keyword + message length.")
    except Exception as e:
        logger.error(f"RAG Search Error: {e}", exc_info=True)
        extra_instruction = f' Answer politely. If data missing, politely ask clarifying questions instead of handoff. {order_instruction}'
    return sheet_context, extra_instruction, query_vector, best_hit_row_id

def check_token_availability(user_profile, ai_model_name):
    """
    Checks if user has any active subscription that allows the given model
    and has remaining tokens.
    """
    from users.models import Subscription
    from django.utils import timezone
    
    return Subscription.objects.filter(
        profile=user_profile,
        is_active=True,
        end_date__gt=timezone.now(),
        remaining_tokens__gt=0,
        offer__allowed_models__model_id=ai_model_name
    ).exists()

def deduct_user_tokens(user_profile, total_tokens, ai_model_name, is_image_query=False):
    if total_tokens > 0:
        try:
            from users.models import Subscription
            from django.utils import timezone
            
            remaining_to_deduct = total_tokens
            
            # Fetch all matching active subscriptions
            subs = Subscription.objects.filter(
                profile=user_profile,
                is_active=True,
                end_date__gt=timezone.now(),
                remaining_tokens__gt=0,
                offer__allowed_models__model_id=ai_model_name
            )
            
            if is_image_query:
                # Prioritize plans WITH image support
                subs = subs.order_by('-offer__image_support', 'end_date')
            else:
                # Prioritize plans WITHOUT image support
                subs = subs.order_by('offer__image_support', 'end_date')

            for sub in subs:
                if remaining_to_deduct <= 0:
                    break
                
                if sub.remaining_tokens > remaining_to_deduct:
                    # Current sub has more than enough
                    sub.remaining_tokens -= remaining_to_deduct
                    
                    # Send low tokens notification (10% threshold)
                    try:
                        threshold = sub.offer.tokens * 0.1
                        if sub.remaining_tokens <= threshold and (sub.remaining_tokens + remaining_to_deduct) > threshold:
                            from chat.models import Notification
                            Notification.objects.create(
                                user=user_profile.user,
                                message=f"Low tokens alert! Offer '{sub.offer.name}' has less than 10% tokens remaining.",
                                type='low_tokens'
                            )
                    except Exception as e:
                        logger.error(f"Low Tokens Notification Error: {e}")
                        
                    remaining_to_deduct = 0
                    sub.save()
                    logger.info(f"Deducted tokens from Sub {sub.id}. Remaining: {sub.remaining_tokens}")
                else:
                    # Current sub is exhausted or exactly matches
                    remaining_to_deduct -= sub.remaining_tokens
                    sub.remaining_tokens = 0
                    sub.is_active = False
                    sub.save()
                    
                    # Send exhausted notification
                    try:
                        from chat.models import Notification
                        Notification.objects.create(
                            user=user_profile.user,
                            message=f"Offer '{sub.offer.name}' tokens have been exhausted.",
                            type='tokens_exhausted'
                        )
                    except Exception as e:
                        logger.error(f"Exhausted Notification Error: {e}")
                    
                    logger.info(f"Sub {sub.id} exhausted. Still need to deduct {remaining_to_deduct}")

            # Final sync of global balance
            user_profile.sync_balances()

            # Trigger auto-renew if balance is low
            try:
                from users.services.auto_renew_service import check_and_trigger_auto_renew
                check_and_trigger_auto_renew(user_profile)
            except Exception as e:
                logger.error(f"Auto-renew Trigger Error: {e}")
            
            if remaining_to_deduct > 0:
                logger.warning(f"Overdraft! Still needed to deduct {remaining_to_deduct} for {user_profile.user.email}")
            
        except Exception as e:
            logger.error(f"Token Deduction Error: {e}")


def check_schedule_quota(user_profile, required=1):
    """
    Checks whether user has at least `required` schedule slots available.
    """
    from users.models import Subscription
    from django.utils import timezone
    from django.db.models import Sum
    total = Subscription.objects.filter(
        profile=user_profile,
        is_active=True,
        end_date__gt=timezone.now(),
        remaining_schedule_messages__gt=0
    ).aggregate(total=Sum('remaining_schedule_messages'))['total']
    return (total or 0) >= required


def deduct_schedule_quota(user_profile, required=1):
    """
    Deduct schedule message quota similar to token deduction logic.
    Returns the subscription used for deduction (first one).
    Raises ValueError if insufficient quota.
    """
    if required <= 0:
        return None

    from users.models import Subscription
    from django.utils import timezone

    remaining = required
    used_sub = None

    subs = Subscription.objects.filter(
        profile=user_profile,
        is_active=True,
        end_date__gt=timezone.now(),
        remaining_schedule_messages__gt=0
    ).order_by('end_date')

    for sub in subs:
        if remaining <= 0:
            break
        if sub.remaining_schedule_messages > remaining:
            sub.remaining_schedule_messages -= remaining
            sub.save(update_fields=['remaining_schedule_messages'])
            used_sub = used_sub or sub
            remaining = 0
        else:
            remaining -= sub.remaining_schedule_messages
            sub.remaining_schedule_messages = 0
            sub.is_active = False
            sub.save(update_fields=['remaining_schedule_messages', 'is_active'])
            used_sub = used_sub or sub

    user_profile.sync_balances()

    if remaining > 0:
        raise ValueError("No schedule quota left. Please upgrade your plan.")

    return used_sub


def restore_schedule_quota(user_profile, subscription, count=1):
    """
    Refund schedule quota to the provided subscription (if any) and resync balances.
    """
    if subscription and count > 0:
        subscription.remaining_schedule_messages += count
        subscription.is_active = True
        subscription.save(update_fields=['remaining_schedule_messages', 'is_active'])
    user_profile.sync_balances()

def build_ai_context(agent_config, sender_id, text, extra_instruction=None, sheet_context=None, platform='messenger', message_type=None):
    from aiAgent.utils import get_memory_context
    from chat.services import get_last_message
    from aiAgent.memory_handler import calculate_context_score, check_keyword_match

    lower_text = text.lower()
    memory_context = ""
    order_context = ""
    first_message_context = ""
    greeting_only = re.sub(r'[^\w\s\u0980-\u09FF]', ' ', lower_text).strip()
    greeting_only = re.sub(r'\s+', ' ', greeting_only)
    is_simple_greeting = greeting_only in {
        'hi', 'hello', 'hey', 'salam', 'assalamualaikum', 'assalamu alaikum',
        'আসসালামু আলাইকুম', 'সালাম', 'হাই', 'হ্যালো'
    }
    
    # 1. Fallback Static Triggers
    static_triggers = ['আমার অর্ডার', 'আমার নাম', 'নাম', 'অর্ডার', 'আগের', 'my', 'name', 'order', 'status']
    
    # 2. Dynamic DB-backed Keyword Triggers 
    matched_intents = check_keyword_match(text, 'intent')
    matched_targets = check_keyword_match(text, 'target')
    
    # 3. Context Score checking (Phone, Email, Location, Urgency)
    c_score = calculate_context_score(text)
    
    is_memory_needed = False
    if any(word in lower_text for word in static_triggers):
        is_memory_needed = True
    elif matched_intents or matched_targets:
        is_memory_needed = True
    elif c_score >= 3:
        is_memory_needed = True

    mem_data = ""
    try:
        mem_data = get_memory_context(agent_config, sender_id)
    except Exception:
        mem_data = ""

    if is_memory_needed:
        if mem_data:
            memory_context = f"\nUser Database Memory [Very Important]:\n{mem_data}"
            logger.info(f"🧠 Injecting Memory Context for {sender_id}. Score: {c_score} | DB Triggers: {matched_intents or matched_targets}")

    try:
        recent_history = get_last_message(agent_config, sender_id, limit=3, platform=platform)
        user_message_count = len([
            msg for msg in recent_history
            if msg.get("role") == "user" and msg.get("content")
        ])
        if mem_data and user_message_count <= 1:
            first_message_context = (
                "\n[KNOWN CUSTOMER MEMORY]:\n"
                f"{mem_data}\n"
                "Directive: This appears to be the customer's first message in this new conversation/session. "
                "If the memory suggests they are a returning or known customer, greet them warmly and naturally using known details when appropriate. "
                "Do not expose raw memory keys; keep the greeting short and helpful."
            )
            logger.info(f"👋 Injecting known-customer first-message memory for {sender_id}")
    except Exception as e:
        logger.error(f"Error building first-message memory context: {e}")

    try:
        from aiAgent.models import UserMemory

        memory = UserMemory.objects.filter(ai_agent=agent_config, sender_id=str(sender_id).lower()).first()
        if memory and isinstance(memory.data, dict):
            internal = memory.data.get('_internal', {})
            order_state = internal.get('order_state', 'idle')
            order_fields = internal.get('order_fields', {})
            failed_attempts = internal.get('failed_attempts', {})
            interruption_buffer = internal.get('interruption_buffer', {})
            recent_interest = internal.get('recent_order_interest') or {}
            
            last_img = internal.get('last_image_caption')
            if last_img:
                order_context += f"\n[ACTIVE DISCUSSION IMAGE CAPTION]:\n[Image: {last_img}]\n"

            collected = []
            missing = []
            for field_name in ['customer_name', 'phone_number', 'address', 'product_name', 'quantity']:
                field_data = order_fields.get(field_name, {})
                if field_data.get('value') and field_data.get('confidence', 1.0) >= 0.75:
                    collected.append(f"{field_name}={field_data.get('value')}")
                else:
                    if field_name == 'product_name' and recent_interest.get('product_name'):
                        collected.append(f"product_name={recent_interest.get('product_name')}")
                    else:
                        missing.append(field_name)

            strike_lines = []
            for field_name, stats in failed_attempts.items():
                strike = stats.get('strike_context') or stats.get('count')
                if strike:
                    strike_lines.append(f"{field_name}: strike {strike}")

            if order_state in ['ordering', 'editing', 'awaiting_confirmation'] or recent_interest.get('product_name'):
                order_context = (
                    "\n[ORDER MEMORY STATE]:\n"
                    f"state={order_state}\n"
                    f"collected={'; '.join(collected) if collected else 'none'}\n"
                    f"missing={', '.join(missing) if missing else 'none'}\n"
                    f"failed_attempts={'; '.join(strike_lines) if strike_lines else 'none'}\n"
                )

                if order_state == 'idle' and recent_interest.get('product_name'):
                    order_context += (
                        "\nDirective: The customer recently discussed or showed interest in this product but hasn't placed the order yet. "
                        "If they now confirm, say yes, or express intent to order/buy (e.g. saying 'Hum', 'Ha', 'yes', 'ok', 'korte cai'), "
                        "you MUST set order_intent to 'create' and proceed to collect the missing details: "
                        f"{', '.join(missing)}. Ask for them politely. Do not repeat mismatch warnings or design details."
                    )
                else:
                    order_context += (
                        "\nDirective: Use collected order fields as truth. Do not fill missing order fields from knowledge-base text. "
                        "Do not ask the customer for price; backend/catalog validation supplies product price. "
                        "Ask only for the next missing field, unless the user asks a separate policy/product question."
                    )

                if is_simple_greeting:
                    order_context += "\nDirective: The user only greeted. Reply with a warm greeting only; do not push order progress or ask missing order fields in this reply."

                if order_state == 'awaiting_confirmation':
                    order_context += "\nDirective: Wait for confirmation, edit, or cancellation. Do not create an order without confirmation."

                if interruption_buffer.get('active'):
                    order_context += (
                        "\nDirective: This is an order side-track. Answer the side question only. "
                        "Suppress order ticks, summaries, and field prompts in this reply."
                    )
    except Exception as e:
        logger.error(f"Error building order memory context: {e}")

    # 3.5 Visitor Tracking Context
    visitor_context = ""
    try:
        # Try to find WebsiteVisitor by platform sender_id (WhatsApp style) first,
        # fall back to visitor_uuid when sender_id is a valid UUID.
        visitor = None
        if sender_id:
            try:
                visitor = WebsiteVisitor.objects.filter(sender_id=sender_id).first()
            except Exception:
                visitor = None

        if not visitor and sender_id:
            # attempt to match UUID if sender_id looks like one
            try:
                import uuid as _uuid
                _uuid.UUID(str(sender_id))
                visitor = WebsiteVisitor.objects.filter(visitor_uuid=sender_id).first()
            except Exception:
                visitor = None

        if visitor:
            v_info = []
            if visitor.location: v_info.append(f"Location: {visitor.location}")
            v_info.append(f"Total Visits: {visitor.view_count}")
            if visitor.captured_email: v_info.append(f"Email: {visitor.captured_email}")
            if visitor.captured_phone: v_info.append(f"Phone: {visitor.captured_phone}")
            
            if v_info:
                visitor_context = "\n[VISITOR TRACKING DATA]:\n" + " | ".join(v_info)
                visitor_context += "\nDirective: Use this data for a personalized greeting if this is a returning visitor or if location/contact info is relevant. Be natural."
                logger.info(f"📊 Injecting Visitor Context for {sender_id}")
    except Exception as e:
        logger.error(f"Error fetching visitor context: {e}")

    # 4. Fetch Contact specific settings
    from aiAgent.models import Contact
    custom_role = agent_config.system_prompt
    contact_instructions = extra_instruction or ""

    try:
        contact = Contact.objects.filter(agent=agent_config, identifier=sender_id).first()
        if contact:
            if contact.custom_prompt:
                custom_role = contact.custom_prompt
                logger.info(f"🎯 Using Custom Role for {sender_id}")
            if contact.custom_instructions:
                contact_instructions = f"{contact_instructions}\n[CONTACT SPECIFIC INSTRUCTIONS]: {contact.custom_instructions}"
                logger.info(f"📝 Adding Custom Instructions for {sender_id}")
    except Exception as e:
        logger.error(f"Error fetching contact settings: {e}")

    system_prompt_parts = [
        f"Identity: Always identify you are assistant of the {agent_config.name} if asked.",
        f"Role: {custom_role}",
        f"Instructions: {contact_instructions}"
    ]

    if sheet_context: system_prompt_parts.append(sheet_context)
    if memory_context: system_prompt_parts.append(memory_context)
    if first_message_context: system_prompt_parts.append(first_message_context)
    if order_context: system_prompt_parts.append(order_context)
    if visitor_context: system_prompt_parts.append(visitor_context)

    system_instruction = "\n\n".join(system_prompt_parts)

    current_message = text
    if message_type in ['image', 'video', 'audio', 'document'] and isinstance(text, str) and text.strip().startswith('['):
        current_message = (
            f"{text} "
            "(System Note: The user uploaded an image. Our image-search engine matched this "
            "image with the product in the KNOWLEDGE BASE DATA below. Treat that product as the core topic of this image.)"
        )
        logger.info("🖼️ Image placeholder detected; rewriting current user message so the model understands this is a media-driven RAG match.")

    logger.info(f"\n======= SYSTEM INSTRUCTION =======\n{system_instruction}\n=======================================")
    logger.info(f"\n======= CURRENT USER MSG =======\n{current_message}\n=======================================")

    raw_history = get_last_message(agent_config, sender_id, limit=agent_config.get_settings.history_limit, platform=platform)
    
    settings = agent_config.get_settings
    skip_history = False
    if settings.skip_history:
        # Check global smart keywords
        matched_global = check_keyword_match(text, 'history_skip')
        
        # Check per-agent custom history skip keywords
        custom_skips = [k.strip().lower() for k in (settings.history_skip_keywords or "").split(',') if k.strip()]
        matched_custom = [k for k in custom_skips if k in text.lower()]
        
        if matched_global or matched_custom:
            skip_history = True
            logger.info(f"⏭️ Skipping history: Keyword found. Global: {matched_global}, Custom: {matched_custom}")

    if skip_history:
        history = []
    else:
        history = [
            msg for msg in raw_history
            if msg.get("content") and msg.get("content").strip()
        ]
        # Avoid duplicating the current message if it's already the last message in raw_history
        if history and history[-1].get("role") == "user" and history[-1].get("content") == text:
            history.pop()
    return system_instruction, history, current_message

def get_ai_response(agent_config, system_instruction, history, current_message):
    """
    Unified AI handler that dispatches to specific providers.
    """
    from aiAgent.gemini import generate_gemini_reply
    from aiAgent.openai import generate_openai_reply
    from aiAgent.grok import generate_grok_reply
    from aiAgent.openrouter import generate_openrouter_reply
    # --- [DEBUG START] ---
    logger.info("🛠️ --- AI DISPATCHER DEBUG START ---")
    logger.info(f"🛠️ Agent ID: {agent_config.id} | Page ID: {agent_config.page_id}")
    logger.info(f"🛠️ Config AI Model (Legacy): {agent_config.ai_model}")
    # 1. Determine model and provider
    if agent_config.selected_model:
        logger.info(f"🛠️ Selected Model Found: {agent_config.selected_model.name}")
        logger.info(f"🛠️ Provider Detected: {agent_config.selected_model.provider}")
        model_name = agent_config.selected_model.model_id
        provider = agent_config.selected_model.provider # gemini, openai, grok, openrouter
    else:
        # Fallback to legacy field
        logger.warning("⚠️ WARNING: selected_model is NULL! Falling back to legacy fields.")
        model_name = agent_config.ai_model
        provider = 'openai' if 'gpt' in model_name.lower() else 'gemini'
        logger.info(f"🛠️ Fallback Provider: {provider} | Fallback Model: {model_name}")
    logger.info(f"🚀 FINAL DISPATCH: Provider={provider}, Model={model_name}")
    logger.info("🛠️ --- AI DISPATCHER DEBUG END ---")
    ai_response = None
    
    try:
        # 2. Dispatch based on provider
        if provider == 'openai':
            ai_response = generate_openai_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'grok':
            logger.info("🔥 CALLING GROK PROVIDER...")
            ai_response = generate_grok_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'openrouter':
            logger.info("🌐 CALLING OPENROUTER PROVIDER...")
            ai_response = generate_openrouter_reply(system_instruction, history, current_message, agent_config=agent_config)
        elif provider == 'gemini':
            logger.info("♊ CALLING GEMINI PROVIDER...")
            ai_response = generate_gemini_reply(system_instruction, history, current_message, agent_config=agent_config)
        else:
            logger.error(f"🚨 UNKNOWN PROVIDER '{provider}'. Defaulting to Gemini/OpenAI logic.")
            if 'gpt' in model_name.lower():
                ai_response = generate_openai_reply(system_instruction, history, current_message, agent_config=agent_config)
            else:
                ai_response = generate_gemini_reply(system_instruction, history, current_message, agent_config=agent_config)
            
        logger.info(f"🔍 [Provider: {provider}] AI Raw Data: {ai_response}")

        # 3. Handle Dictionary Format
        if isinstance(ai_response, dict):
            raw_reply = ai_response.get('reply', "")
            reply = raw_reply if raw_reply else ai_response.get('error_message', "System busy.")
            
            input_tokens = ai_response.get('input_tokens', 0)
            output_tokens = ai_response.get('output_tokens', 0)
            total_tokens = ai_response.get('total_tokens', 0)
            status = ai_response.get('status', 'unknown')
            
            reply = str(reply).replace('**', '').replace('*', '').strip()
            
            # If explicit failure status is given, rely on it
            if status in ['error', 'empty_response', 'failed']:
                success = False
            else:
                success = (status == 'success') or (len(reply) > 5 and "System busy" not in reply)
                
            error_info = ai_response.get('error_message') if not success else ""
            
            return {
                'reply': reply, 
                'total_tokens': total_tokens, 
                'success': success,
                'input_tokens': input_tokens, 
                'output_tokens': output_tokens, 
                'error': error_info
            }
        else:
            if isinstance(ai_response, tuple):
                reply_text, total_tokens = ai_response
            else:
                reply_text, total_tokens = str(ai_response), 0
                
            clean_reply = str(reply_text).replace('**', '').replace('*', '').strip()
            
            return {
                'reply': clean_reply,
                'total_tokens': total_tokens,
                'success': len(clean_reply) > 2,
                'input_tokens': int(total_tokens * 0.5),
                'output_tokens': total_tokens - int(total_tokens * 0.5),
                'error': ""
            }

    except Exception as e:
        logger.error(f"AI Wrapper Critical Error: {str(e)}", exc_info=True)
        return {
            'reply': "I'm sorry, I'm having trouble connecting to my brain right now. Please try again later!", 
            'total_tokens': 0, 
            'success': False, 
            'error': str(e)
        }

def deliver_whatsapp_reply(data, reply):
    """Deliver final reply for WhatsApp via Baileys directly"""
    from integrations.services.whatsapp import WhatsAppService

    final_target = data.get('delivery_jid') or data.get('sender_id', '')
    session_id = data.get('sessionId') or data.get('session_id')
    if not session_id:
        logger.error('[Logic] WhatsApp delivery blocked: sessionId is empty')
        return False
    if not final_target:
        logger.error('[Logic] WhatsApp delivery blocked: to/delivery_jid is empty')
        return False

    buttons = [
        {"id": "human_help" if not data.get('human_mode') else "resolve_human",
         "title": "🙋 Human Help" if not data.get('human_mode') else "✅ Resolve Human Mode"},
        {"id": "toggle_ai",
         "title": "🔊 On AI Reply" if data.get('stop_ai') else "🔇 Stop AI Reply"},
    ]

    logger.info(f'[Logic] Routing WhatsApp reply via Baileys | to={final_target} | session={session_id}')
    return WhatsAppService.send_message(
        session_id=session_id,
        to=str(final_target),
        message_text=str(reply),
        buttons=buttons,
    )


def deliver_instagram_reply(data, reply, page_id, access_token):
    """Deliver final reply for Instagram via MetaService directly"""
    from integrations.services.meta import MetaService

    sender_id = data.get('sender_id', '')
    logger.info(f'[Logic] Routing Instagram reply via MetaService | page_id={page_id}')
    return MetaService.send_message(
        access_token=access_token,
        recipient_id=str(sender_id),
        message_text=str(reply),
        msg_type='text',
    )


def deliver_facebook_reply(data, reply, page_id, access_token):
    """Deliver final reply for Facebook (Messenger / Comment) via MetaService directly"""
    from integrations.services.meta import MetaService

    sender_id = data.get('sender_id', '')
    request_type = str(data.get('type', 'messenger'))

    if request_type == 'facebook_comment':
        comment_id = data.get('comment_id', '')
        logger.info(f'[Logic] Routing Facebook comment reply via MetaService | comment_id={comment_id}')
        return MetaService.send_comment_reply(
            access_token=access_token,
            comment_id=str(comment_id),
            message_text=str(reply),
        )
    else:
        logger.info(f'[Logic] Routing Messenger reply via MetaService | page_id={page_id}')
        return MetaService.send_message(
            access_token=access_token,
            recipient_id=str(sender_id),
            message_text=str(reply),
            msg_type='text',
        )

def deliver_telegram_reply(data, reply, token):
    """Deliver final reply for Telegram via TelegramService directly"""
    from integrations.services.telegram import TelegramService

    chat_id = data.get('chat_id') or data.get('sender_id')
    if not chat_id:
        logger.error("❌ [Logic] Missing chat_id for Telegram reply")
        return False
    if not token:
        logger.error("❌ [Logic] Missing bot token for Telegram reply")
        return False

    logger.info(f'[Logic] Routing Telegram reply via TelegramService | chat={chat_id}')
    return TelegramService.send_message(
        token=token,
        chat_id=str(chat_id),
        message_text=str(reply),
        msg_type='text',
    )

def get_button_payload(contact):
    """Generate button text and payload based on current contact state"""
    buttons = []
    
    # If this contact has a pending order confirmation, show order actions first
    try:
        from aiAgent.models import UserMemory
        memory = UserMemory.objects.filter(ai_agent=contact.agent, sender_id=contact.identifier).first()
        if memory and isinstance(memory.data, dict):
            internal = memory.data.get('_internal', {})
            order_state = internal.get('order_state')
            if order_state in ['awaiting_confirmation', 'editing']:
                buttons.append({"text": "✅ Confirm Order", "action": "CONFIRM_ORDER"})
                buttons.append({"text": "✏️ Edit Order", "action": "EDIT_ORDER"})
                buttons.append({"text": "❌ Cancel Order", "action": "CANCEL_ORDER"})
                if not contact.is_human_needed:
                    buttons.append({"text": "🙋 Human Help", "action": "HUMAN_HELP"})
                return buttons
    except Exception:
        pass

    # Button 1: Human Help / Resolve Human Mode
    if contact.is_human_needed:
        buttons.append({"text": "✅ Resolve Human Mode", "action": "RESOLVE_HUMAN"})
    else:
        buttons.append({"text": "🙋 Human Help", "action": "HUMAN_HELP"})
        
    # Button 2: Stop AI / On AI
    if contact.is_auto_reply_enabled:
        buttons.append({"text": "🔇 Stop AI Reply", "action": "STOP_AI_REPLY"})
    else:
        buttons.append({"text": "🔊 On AI Reply", "action": "ON_AI_REPLY"})
        
    return buttons

def send_telegram_buttons(chat_id, token, contact, reply_text="\u200e"):
    """Send inline keyboard buttons after Telegram reply via TelegramService"""
    from integrations.services.telegram import TelegramService

    if not token or not chat_id:
        return False

    buttons = get_button_payload(contact)
    inline_keyboard = [[{"text": b["text"], "callback_data": b["action"]} for b in buttons]]
    reply_markup = {"inline_keyboard": inline_keyboard}

    logger.info(f'[Logic] Sending Telegram buttons to {chat_id}')
    return TelegramService.send_message(
        token=token,
        chat_id=str(chat_id),
        message_text=reply_text,
        reply_markup=reply_markup,
        msg_type='text',
    )

def send_messenger_buttons(sender_id, page_id, access_token, contact, reply_text="\u200e"):
    """Send quick_reply buttons after Messenger reply via MetaService"""
    from integrations.services.meta import MetaService

    if not access_token or not sender_id:
        return False

    buttons = get_button_payload(contact)
    short_titles = {
        "HUMAN_HELP": "🙋 Human Mode",
        "RESOLVE_HUMAN": "✅ Resolve Human Mode",
        "STOP_AI_REPLY": "🔇 Stop AI",
        "ON_AI_REPLY": "🔊 On AI"
    }
    quick_replies = [
        {
            "content_type": "text",
            "title": short_titles.get(b["action"], b["text"])[:20],
            "payload": b["action"]
        } for b in buttons
    ]

    logger.info(f'[Logic] Sending Messenger buttons to {sender_id}')
    return MetaService.send_message(
        access_token=access_token,
        recipient_id=str(sender_id),
        message_text=reply_text,
        quick_replies=quick_replies,
        msg_type='text',
    )

def send_instagram_buttons(sender_id, page_id, access_token, contact, reply_text="\u200e"):
    """Send quick_reply buttons after Instagram reply via MetaService"""
    from integrations.services.meta import MetaService

    if not access_token or not sender_id:
        return False

    buttons = get_button_payload(contact)
    quick_replies = [
        {
            "content_type": "text",
            "title": b["text"][:20],
            "payload": b["action"]
        } for b in buttons
    ]

    logger.info(f'[Logic] Sending Instagram buttons to {sender_id}')
    return MetaService.send_message(
        access_token=access_token,
        recipient_id=str(sender_id),
        message_text=reply_text,
        quick_replies=quick_replies,
        msg_type='text',
    )

def send_whatsapp_buttons(data, contact, reply_text="\u200e"):
    """Send button message via Baileys directly for WhatsApp"""
    from integrations.services.whatsapp import WhatsAppService

    final_target = data.get('delivery_jid') or data.get('sender_id', '')
    session_id = data.get('sessionId') or data.get('session_id')
    if not final_target or not session_id:
        logger.error(
            f"[Logic] WhatsApp button delivery blocked: "
            f"to={final_target!r}, sessionId={session_id!r}"
        )
        return False

    buttons_data = get_button_payload(contact)
    has_order_buttons = any(b['action'] in ["CONFIRM_ORDER", "EDIT_ORDER", "CANCEL_ORDER"] for b in buttons_data)

    menu_text = f"{reply_text}\n\n"
    if has_order_buttons:
        labels = []
        for i, b in enumerate(buttons_data, 1):
            label = ''.join(ch for ch in b['text'] if ch.isalnum() or ch.isspace()).strip()
            labels.append(f"{i}: {label}")
        menu_text += "  |  ".join(labels)
    else:
        opt1 = "1: Human Mode"
        if contact.is_human_needed:
            opt1 = "1: Resolve Human"
        opt2 = "2: Off AI"
        if not contact.is_auto_reply_enabled:
            opt2 = "2: On AI"
        menu_text += f"{opt1}          {opt2}"

    logger.info(f'[Logic] Sending WhatsApp buttons to {final_target}')
    return WhatsAppService.send_message(
        session_id=session_id,
        to=str(final_target),
        message_text=menu_text,
    )


# ============================================================================
# 🎤 VOICE NOTIFICATION FUNCTIONS - Send Voice Files to All Platforms
# ============================================================================

def send_voice_notification(sender_id, platform, voice_file, agent_data=None, page_id=None, access_token=None, token=None):
    """
    Send voice notification to user on their platform
    
    Args:
        sender_id: User's ID on the platform
        platform: 'whatsapp', 'messenger', 'facebook_comment', 'instagram', 'telegram', etc
        voice_file: Filename of voice (e.g., 'on-human-mode.wav', 'off-ai-reply.wav')
        agent_data: Optional dict with additional platform-specific data
        page_id: Facebook page ID (for messenger/instagram)
        access_token: Facebook access token
        token: Telegram bot token
    
    Returns:
        bool: True if voice was sent successfully
    """
    
    if not sender_id or not voice_file:
        logger.error("🎤 Voice send failed: Missing sender_id or voice_file")
        return False
    
    agent_data = agent_data or {}
    platform = (platform or 'whatsapp').lower()
    
    try:
        if platform == 'whatsapp':
            return _send_whatsapp_voice(sender_id, voice_file, agent_data)
        elif platform == 'messenger':
            return _send_messenger_voice(sender_id, voice_file, page_id, access_token)
        elif platform == 'facebook_comment':
            return _send_messenger_voice(sender_id, voice_file, page_id, access_token)
        elif platform == 'instagram':
            return _send_instagram_voice(sender_id, voice_file, page_id, access_token)
        elif platform == 'telegram':
            return _send_telegram_voice(sender_id, voice_file, token, agent_data)
        else:
            logger.warning(f"🎤 Voice delivery not supported for platform: {platform}")
            return False
    except Exception as e:
        logger.error(f"🎤 Voice notification send error: {e}", exc_info=True)
        return False


def get_voice_media_url(voice_file, platform=None):
    """Return an environment-aware URL for voice files."""
    import os

    voice_file = str(voice_file)
    selected_file = voice_file
    if platform and platform.lower() == 'whatsapp' and voice_file.lower().endswith('.wav'):
        selected_file = voice_file[:-4] + '.ogg'
        logger.debug(f"🎤 WhatsApp target detected; using OGG voice file {selected_file}")

    explicit_voice_url = os.getenv('VOICE_MEDIA_URL')
    if explicit_voice_url:
        url = explicit_voice_url.rstrip('/') + '/' + selected_file
        logger.debug(f"🎤 Voice media resolved via VOICE_MEDIA_URL: {url}")
        return url

    minio_ext_endpoint = os.getenv('MINIO_EXTERNAL_ENDPOINT', '').rstrip('/')
    bucket = os.getenv('MINIO_STORAGE_BUCKET_NAME', 'newsmartagent-media')
    if minio_ext_endpoint:
        url = f"{minio_ext_endpoint}/{bucket}/{selected_file}"
        logger.debug(f"🎤 Voice media resolved via MINIO_EXTERNAL_ENDPOINT: {url}")
        return url

    media_url = os.getenv('MEDIA_URL', '/media/')
    url = f"{media_url.rstrip('/')}/voice/{selected_file}"
    logger.debug(f"🎤 Voice media resolved via MEDIA_URL fallback: {url}")
    return url


def _send_whatsapp_voice(sender_id, voice_file, data):
    """Send voice file via WhatsApp through Baileys directly"""
    from integrations.services.whatsapp import WhatsAppService

    final_target = data.get('delivery_jid') or sender_id
    session_id = data.get('sessionId') or data.get('session_id', '')
    media_url = get_voice_media_url(voice_file, platform='whatsapp')

    logger.info(f'🎤 [Logic] Sending WhatsApp voice: {voice_file} to {sender_id}')
    return WhatsAppService.send_message(
        session_id=session_id,
        to=str(final_target),
        message_text='',
        msg_type='audio',
        media_url=media_url,
    )


def _send_messenger_voice(sender_id, voice_file, page_id, access_token):
    """Send voice file via Messenger/Facebook through MetaService directly"""
    from integrations.services.meta import MetaService

    if not page_id or not access_token:
        logger.error("🎤 Messenger voice send failed: Missing page_id or access_token")
        return False

    media_url = get_voice_media_url(voice_file, platform='messenger')
    logger.info(f'🎤 [Logic] Sending Messenger voice: {voice_file} to {sender_id}')
    return MetaService.send_message(
        access_token=access_token,
        recipient_id=str(sender_id),
        message_text='',
        msg_type='audio',
        media_url=media_url,
    )


def _send_instagram_voice(sender_id, voice_file, page_id, access_token):
    """Send voice file via Instagram through MetaService directly"""
    from integrations.services.meta import MetaService

    if not page_id or not access_token:
        logger.error("🎤 Instagram voice send failed: Missing page_id or access_token")
        return False

    media_url = get_voice_media_url(voice_file, platform='instagram')
    logger.info(f'🎤 [Logic] Sending Instagram voice: {voice_file} to {sender_id}')
    return MetaService.send_message(
        access_token=access_token,
        recipient_id=str(sender_id),
        message_text='',
        msg_type='audio',
        media_url=media_url,
    )


def _send_telegram_voice(sender_id, voice_file, token, data):
    """Send voice file via Telegram through TelegramService directly"""
    from integrations.services.telegram import TelegramService

    chat_id = data.get('chat_id') or sender_id
    if not chat_id or not token:
        logger.error("🎤 Telegram voice send failed: Missing chat_id or token")
        return False

    media_url = get_voice_media_url(voice_file, platform='telegram')
    logger.info(f'🎤 [Logic] Sending Telegram voice: {voice_file} to {chat_id}')
    return TelegramService.send_voice(token=token, chat_id=str(chat_id), media_url=media_url)

def deliver_dashboard_reply(user_id, reply_text, message_id):
    """Deliver final reply to the dashboard via WebSocket and update the log"""
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        from aiAgent.models import DashboardAILog

        # Update log
        DashboardAILog.objects.filter(message_id=message_id).update(answer=reply_text)

        # Send via WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"user_{user_id}",
            {
                "type": "send_notification",
                "content": {
                    "action": "DASHBOARD_AI_REPLY",
                    "message_id": message_id,
                    "reply": reply_text
                }
            }
        )
        logger.info(f"✅ Dashboard reply sent via WebSocket for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"Dashboard WebSocket delivery failure: {e}")
        return False

def log_token_usage(agent_config, sender_id, ai_data, duration, request_type, platform=None):
    try:
        effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model
        platform_value = platform or request_type or agent_config.platform or "messenger"
        TokenUsageLog.objects.create(
            user=agent_config.user,
            ai_agent=agent_config,
            sender_id=sender_id,
            model_name=effective_model,
            input_tokens=ai_data.get('input_tokens', 0),
            output_tokens=ai_data.get('output_tokens', 0),
            total_tokens=ai_data.get('total_tokens', 0),
            platform=platform_value,
            response_time=duration,
            success=ai_data.get('success', False),
            error_message=ai_data.get('error', ''),
            request_type=request_type
        )
    except Exception as e:
        logger.error(f"Logging Error: {e}")

def acquire_user_lock(task_instance, redis_client, sender_id):
    lock_key = f"chat_lock:{sender_id}"
    lock_value = str(uuid.uuid4())
    is_locked = redis_client.set(lock_key, lock_value, nx=True, ex=150)
    if not is_locked:
        logger.info(f"User {sender_id} busy. Retrying...")
        raise task_instance.retry(countdown=5)
    return is_locked, lock_key, lock_value

def is_duplicate_or_outdated(msg_id, incoming_ts, agent_config, sender_id, redis_client):
    if msg_id:
        # 1. Check if already permanently processed
        if redis_client.get(f'processed_msg:{msg_id}'):
            logger.info(f"Duplicate message detected (Already Processed): {msg_id}")
            return True
        
        # 2. Check if currently being processed (Race Condition Prevention)
        # We use a 'processing' key with 60s expiry to ensure one worker handles it
        if not redis_client.set(f'processing_msg:{msg_id}', '1', nx=True, ex=60):
            logger.info(f"⏭️ Task Already in Progress for msg_id: {msg_id}")
            return True

    if incoming_ts:
        try:
            incoming_ts = float(incoming_ts)
            if incoming_ts > 1e12: incoming_ts /= 1000
            latest = get_last_message(agent_config, sender_id, limit=1)
            if latest and latest[0].get('timestamp', 0) > incoming_ts:
                logger.info(f"Zombie Outdated task detected for {sender_id}. Skipping.")
                return True
        except (ValueError, TypeError) as e:
            logger.error(f"Zombie Check Error: {e}")
    return False

def handle_public_comment_logic(data, agent_config, r):
    sender_id = str(data.get('sender_id', ''))
    page_id = str(data.get('page_id', ''))
    comment_id = data.get('comment_id')
    request_type = data.get('type')

    if sender_id == page_id:
        return False, "page_own_activity"

    if request_type == 'facebook_comment' and comment_id:
        comment_lock_key = f'processed_comment:{comment_id}'
        if not r.get(comment_lock_key):
            from webhooks.comment import deliver_public_comment_reply
            reply_text = 'ধন্যবাদ! আপনার ইনবক্স চেক করুন, বিস্তারিত পাঠানো হয়েছে। 😊'
            r.set(comment_lock_key, '1', ex=3600)
            deliver_public_comment_reply(comment_id, reply_text, agent_config.access_token)
            return True, "public_reply_sent"
    return True, "continue"

def handle_ai_response(agent_id, sender_id, message_text, platform='web_widget'):
    """
    Unified synchronous handler for direct AI responses (like Web Widget).
    Handles context, RAG, AI call, token deduction, and logging.
    """
    start_time = time.time()
    try:
        agent_config = AgentAI.objects.get(id=agent_id)
        user_profile = agent_config.user.profile
        
        # 1. Token Check
        effective_model = agent_config.selected_model.model_id if agent_config.selected_model else agent_config.ai_model
        if not check_token_availability(user_profile, effective_model):
            return "Sorry, the agent has run out of tokens. Please contact the site owner."

        # 2. Context & RAG
        order_instr = get_order_instructions(agent_config.user)
        sheet_ctx, extra_instr, query_vector, _ = perform_rag_search(
            agent_config, message_text, "", order_instr, sender_id=sender_id
        )
        system_instruction, history, current_msg = build_ai_context(
            agent_config, sender_id, message_text, extra_instr, sheet_ctx, platform=platform
        )

        # 3. AI Call
        ai_data = get_ai_response(agent_config, system_instruction, history, current_msg)
        reply = ai_data.get('reply', 'System busy.')
        success = ai_data.get('success', False)
        total_tokens = ai_data.get('total_tokens', 0)

        if success:
            # 4. Token Deduction
            deduct_user_tokens(user_profile, total_tokens, effective_model)
            
            # 5. Save Messages
            save_message(agent_config, sender_id, message_text, 'user', platform=platform)
            save_message(agent_config, sender_id, reply, 'assistant', tokens=total_tokens, platform=platform)
            
            # 6. Memory Update
            handle_smart_memory_update(agent_config, sender_id, message_text)

        # 7. Token Usage Log
        duration = int((time.time() - start_time) * 1000)
        log_token_usage(agent_config, sender_id, ai_data, duration, 'widget_direct', platform=platform)

        return reply

    except Exception as e:
        logger.error(f"Error in handle_ai_response: {e}", exc_info=True)
        return "I'm sorry, I'm having trouble processing your request right now."
