"""
Public comment automation (Facebook / Instagram).

Design goals
- Seller controls behaviour per agent via CommentAutomationSettings (off / fixed / ai / hybrid).
- AI intent is decided by ONE small structured LLM call per comment (no keyword matching).
- Token safe: post context is cached per post, structural pre-filters skip empty/emoji/tag-only
  comments, per-day AI cap and low-balance fallback to Fixed templates.
- If an agent has no CommentAutomationSettings row, the legacy behaviour is left untouched.
"""
import json
import logging
import random
import re
import time

from django.core.cache import cache

logger = logging.getLogger('aiAgent')

CLASSIFIER_MODEL = 'gemini-3.1-flash-lite'
POST_CTX_MAX_CHARS = 300
POST_CTX_SUMMARIZE_ABOVE = 600
POST_CTX_TTL = 7 * 24 * 3600
POST_CTX_NEG_TTL = 24 * 3600

VALID_INTENTS = {
    'price_inquiry', 'product_inquiry', 'order_intent', 'delivery_query',
    'complaint', 'praise', 'spam_abuse', 'tag_friend', 'emoji_only', 'other',
}


# ───────────────────────── helpers ───────────────────────── #

def normalize_platform(value):
    value = str(value or '').lower()
    if value.startswith('instagram'):
        return 'instagram'
    return 'facebook'


def resolve_agent(page_id, platform):
    from aiAgent.models import AgentAI
    pid = str(page_id or '').lower()
    if not pid:
        return None
    qs = AgentAI.objects.filter(is_active=True, page_id=pid)
    if platform == 'facebook':
        qs = qs.filter(platform__in=['messenger', 'facebook_comment'])
    else:
        qs = qs.filter(platform='instagram')
    return qs.order_by('-id').first()


def _effective_model(agent):
    return agent.selected_model.model_id if agent.selected_model else agent.ai_model


def _remaining_tokens(profile, model_id):
    from django.db.models import Sum
    from django.utils import timezone
    from users.models import Subscription
    agg = Subscription.objects.filter(
        profile=profile,
        is_active=True,
        end_date__gt=timezone.now(),
        remaining_tokens__gt=0,
        offer__allowed_models__model_id=model_id,
    ).aggregate(total=Sum('remaining_tokens'))
    return int(agg['total'] or 0)


def _counter_incr(key, ttl):
    cache.add(key, 0, ttl)
    try:
        return cache.incr(key)
    except ValueError:
        cache.set(key, 1, ttl)
        return 1


def _has_text_content(text):
    """Structural check (not keyword based): does the string contain any letter/digit?"""
    return any(ch.isalnum() for ch in (text or ''))


def _strip_mentions(text):
    return ' '.join(tok for tok in (text or '').split() if not tok.startswith('@')).strip()


# ───────────────────────── dispatch entry (webhook) ───────────────────────── #

def maybe_dispatch(payload):
    """
    Called by the Meta webhook for each new public comment.
    Returns True when the comment was handed to the new pipeline (the legacy flow must not run).
    """
    try:
        platform = normalize_platform(payload.get('platform') or payload.get('type'))
        agent = resolve_agent(payload.get('page_id'), platform)
        if not agent:
            return False
        from settings.models import CommentAutomationSettings
        cfg = CommentAutomationSettings.get_active_for_agent(agent)
        if not cfg:
            return False
        from settings.tasks import process_comment_task
        process_comment_task.delay(payload)
        return True
    except Exception as exc:
        logger.error(f"[CommentAuto] dispatch failed, falling back to legacy: {exc}")
        return False


# ───────────────────────── post context ───────────────────────── #

def get_post_context(agent, platform, post_id):
    """Compact post context. Cached per post (including negative results)."""
    if not post_id:
        return ''
    post_id = str(post_id)

    from settings.models import PostContextNote
    note = PostContextNote.objects.filter(agent=agent, post_id=post_id).first()
    if note:
        return note.note[:POST_CTX_MAX_CHARS]

    key = f"cmt_post_ctx:{platform}:{post_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    text = ''
    if platform == 'facebook':
        try:
            from chat.models import PostCache
            pc = PostCache.objects.filter(post_id=post_id).first()
            if pc and pc.summary:
                text = pc.summary
        except Exception:
            pass

    if not text:
        from integrations.services.meta_comments import MetaCommentService
        text = MetaCommentService.fetch_post_text(platform, agent.access_token, post_id)

    text = re.sub(r'\s+', ' ', text or '').strip()
    if len(text) > POST_CTX_SUMMARIZE_ABOVE:
        try:
            from aiAgent.gemini import generate_quick_summary
            summary = generate_quick_summary(text)
            text = re.sub(r'\s+', ' ', summary or text).strip()
        except Exception:
            pass
    text = text[:POST_CTX_MAX_CHARS]

    cache.set(key, text, POST_CTX_TTL if text else POST_CTX_NEG_TTL)
    return text


# ───────────────────────── AI classification ───────────────────────── #

_SYSTEM_PROMPT = (
    "You moderate public comments on a Bangladeshi online shop's social media page.\n"
    "Return ONLY a valid JSON object with exactly these keys:\n"
    '{"intent": str, "language": str, "is_spam": bool, "needs_private_followup": bool, '
    '"confidence": number, "public_reply": str, "dm_text": str}\n'
    "intent must be one of: price_inquiry, product_inquiry, order_intent, delivery_query, "
    "complaint, praise, spam_abuse, tag_friend, emoji_only, other.\n"
    "Rules:\n"
    "- public_reply: max 200 characters, warm and short, in the SAME language/script as the "
    "comment (Bangla script, English or Banglish). Never invent prices, stock, phone numbers or links.\n"
    "- If the commenter asks about price, availability, order, size or delivery, say that the "
    "details have been sent to their inbox.\n"
    "- Use an empty public_reply for spam, abuse, tag_friend and emoji-only comments.\n"
    "- dm_text: max 280 characters inbox opener that greets, acknowledges the question and asks "
    "which exact product/size/quantity they want. Empty if no inbox message is needed.\n"
    "- is_spam is true for ads, links, scams, abuse or profanity.\n"
    "- confidence is between 0 and 1."
)


def _parse_json(text):
    text = (text or '').strip()
    text = re.sub(r'^```(?:json)?|```$', '', text, flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except Exception:
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                return None
    return None


def classify_comment(agent, comment_text, post_ctx, commenter_name):
    """One small structured LLM call. Returns dict (always) with token counts."""
    out = {
        'intent': 'other', 'language': '', 'is_spam': False,
        'needs_private_followup': False, 'confidence': 0.0,
        'public_reply': '', 'dm_text': '',
        'input_tokens': 0, 'output_tokens': 0, 'total_tokens': 0, 'success': False,
    }
    try:
        from aiAgent import gemini as gem
        if not gem.GENAI_CLIENT:
            out['error'] = 'gemini_not_configured'
            return out

        biz = (agent.system_prompt or '')[:700]
        user_content = (
            f"Shop info: {biz}\n"
            f"Post context: {post_ctx or 'none (media-only post)'}\n"
            f"Commenter: {commenter_name or 'unknown'}\n"
            f"Comment: {comment_text[:600]}"
        )
        response = gem.GENAI_CLIENT.models.generate_content(
            model=CLASSIFIER_MODEL,
            contents=[user_content],
            config=gem.types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.3,
                max_output_tokens=260,
                response_mime_type='application/json',
            ),
        )
        usage = getattr(response, 'usage_metadata', None)
        out['input_tokens'] = int(getattr(usage, 'prompt_token_count', 0) or 0)
        out['total_tokens'] = int(getattr(usage, 'total_token_count', 0) or 0)
        out['output_tokens'] = max(0, out['total_tokens'] - out['input_tokens'])

        parsed = _parse_json(response.text)
        if not isinstance(parsed, dict):
            out['error'] = 'bad_json'
            return out

        intent = str(parsed.get('intent') or 'other').strip().lower()
        out['intent'] = intent if intent in VALID_INTENTS else 'other'
        out['language'] = str(parsed.get('language') or '')[:20]
        out['is_spam'] = bool(parsed.get('is_spam')) or out['intent'] == 'spam_abuse'
        out['needs_private_followup'] = bool(parsed.get('needs_private_followup'))
        try:
            out['confidence'] = max(0.0, min(1.0, float(parsed.get('confidence') or 0)))
        except (TypeError, ValueError):
            out['confidence'] = 0.0
        out['public_reply'] = str(parsed.get('public_reply') or '').strip()[:300]
        out['dm_text'] = str(parsed.get('dm_text') or '').strip()[:400]
        out['success'] = True
    except Exception as exc:
        logger.error(f"[CommentAuto] classify failed: {exc}")
        out['error'] = str(exc)[:200]
    return out


# ───────────────────────── main pipeline ───────────────────────── #

def _log(agent, platform, payload, **fields):
    from settings.models import CommentActivityLog
    try:
        return CommentActivityLog.objects.create(
            agent=agent,
            platform=platform,
            comment_id=str(payload.get('comment_id') or '')[:255],
            post_id=str(payload.get('post_id') or '')[:255],
            commenter_id=str(payload.get('sender_id') or '')[:255],
            commenter_name=str(payload.get('push_name') or '')[:255],
            comment_text=str(payload.get('message') or '')[:2000],
            **fields,
        )
    except Exception as exc:
        logger.error(f"[CommentAuto] log write failed: {exc}")
        return None


def process_comment(payload):
    from settings.models import CommentAutomationSettings
    from settings.tasks import execute_comment_plan_task

    platform = normalize_platform(payload.get('platform') or payload.get('type'))
    agent = resolve_agent(payload.get('page_id'), platform)
    if not agent:
        return 'no_agent'
    cfg = CommentAutomationSettings.get_active_for_agent(agent)
    if not cfg or cfg.mode == 'off':
        return 'off'

    comment_id = str(payload.get('comment_id') or '')
    if not comment_id:
        return 'no_comment_id'

    # duplicate / retry protection
    if not cache.add(f"cmt_auto:{platform}:{comment_id}", 1, 7 * 24 * 3600):
        return 'duplicate'

    commenter = str(payload.get('sender_id') or '')
    if commenter and commenter == str(payload.get('page_id') or ''):
        return 'self'

    text = str(payload.get('message') or '').strip()
    post_id = str(payload.get('post_id') or '')
    parent_id = str(payload.get('parent_id') or '')
    mode = cfg.mode

    def skip(reason):
        _log(agent, platform, payload, mode_used=mode, status='skipped', skip_reason=reason)
        return reason

    # nested replies
    is_nested = bool(parent_id) and (platform == 'instagram' or parent_id != post_id)
    if is_nested and not cfg.reply_to_nested:
        return skip('nested_reply')

    # only selected posts
    if cfg.only_post_ids and post_id not in [str(p) for p in cfg.only_post_ids]:
        return skip('post_not_selected')

    # structural filters (no keywords): empty / emoji-only / mention-only
    if not _has_text_content(text):
        return skip('no_text_or_emoji_only')
    if not _has_text_content(_strip_mentions(text)):
        return skip('tag_only')

    # hourly reply cap
    hour_key = f"cmt_auto_rate:{agent.id}:{time.strftime('%Y%m%d%H')}"
    if _counter_incr(hour_key, 3700) > cfg.hourly_reply_limit:
        return skip('hourly_limit')

    # decide whether AI may be used
    use_ai = mode in ('ai', 'hybrid')
    fallback_note = ''
    if use_ai:
        profile = agent.user.profile
        model_id = _effective_model(agent)
        from aiAgent.business_logic.logic_handler import check_token_availability
        if not check_token_availability(profile, model_id):
            use_ai, fallback_note = False, 'no_tokens'
        elif _remaining_tokens(profile, model_id) < cfg.low_balance_threshold:
            use_ai, fallback_note = False, 'low_balance'
        else:
            day_key = f"cmt_ai_daily:{agent.id}:{time.strftime('%Y%m%d')}"
            if _counter_incr(day_key, 90000) > cfg.daily_ai_comment_limit:
                use_ai, fallback_note = False, 'daily_ai_limit'

    plan = {
        'agent_id': agent.id, 'platform': platform, 'mode_used': mode,
        'payload': {k: payload.get(k) for k in
                    ('comment_id', 'post_id', 'sender_id', 'push_name', 'message', 'page_id')},
        'public_text': '', 'dm_text': '', 'hide': False,
        'intent': '', 'confidence': 0.0, 'tokens_used': 0, 'skip_reason': fallback_note,
    }

    if use_ai:
        post_ctx = get_post_context(agent, platform, post_id)
        ai = classify_comment(agent, text, post_ctx, payload.get('push_name'))
        plan['intent'] = ai['intent']
        plan['confidence'] = ai['confidence']
        plan['tokens_used'] = ai['total_tokens']

        if ai['total_tokens'] > 0:
            try:
                from aiAgent.business_logic.logic_handler import deduct_user_tokens, log_token_usage
                deduct_user_tokens(agent.user.profile, ai['total_tokens'], _effective_model(agent))
                log_token_usage(agent, commenter, ai, 0, 'comment_ai', platform=f'{platform}_comment')
            except Exception as exc:
                logger.error(f"[CommentAuto] token accounting failed: {exc}")

        if not ai['success']:
            _log(agent, platform, payload, mode_used=mode, status='review',
                 skip_reason='ai_failed', error=ai.get('error', ''), tokens_used=ai['total_tokens'])
            return 'ai_failed'

        if ai['is_spam']:
            if mode == 'hybrid' and cfg.hide_spam_enabled and ai['confidence'] >= cfg.hide_confidence_threshold:
                plan['hide'] = True
            else:
                _log(agent, platform, payload, mode_used=mode, intent=ai['intent'],
                     confidence=ai['confidence'], status='review', skip_reason='spam_suspected',
                     tokens_used=ai['total_tokens'])
                return 'spam_review'
        elif ai['confidence'] < cfg.confidence_threshold:
            _log(agent, platform, payload, mode_used=mode, intent=ai['intent'],
                 confidence=ai['confidence'], status='review', skip_reason='low_confidence',
                 tokens_used=ai['total_tokens'])
            return 'low_confidence'
        else:
            if cfg.public_reply_enabled and ai['public_reply']:
                plan['public_text'] = ai['public_reply']
            if cfg.private_dm_enabled and ai['needs_private_followup'] and ai['dm_text']:
                plan['dm_text'] = ai['dm_text']
            if ai['intent'] == 'complaint':
                _notify_seller(agent, f"কমেন্টে অভিযোগ: {text[:80]}")
    else:
        templates = [t for t in (cfg.fixed_templates or []) if str(t).strip()]
        if cfg.public_reply_enabled and templates:
            plan['public_text'] = random.choice(templates)
        if cfg.private_dm_enabled and (cfg.fixed_dm_template or '').strip():
            plan['dm_text'] = cfg.fixed_dm_template.strip()

    if not (plan['public_text'] or plan['dm_text'] or plan['hide']):
        _log(agent, platform, payload, mode_used=mode, intent=plan['intent'],
             confidence=plan['confidence'], status='skipped', skip_reason='nothing_to_do',
             tokens_used=plan['tokens_used'])
        return 'nothing_to_do'

    delay = 0
    if plan['public_text'] or plan['dm_text']:
        lo, hi = sorted((cfg.reply_delay_min, cfg.reply_delay_max))
        delay = random.randint(lo, hi)
    execute_comment_plan_task.apply_async(args=[plan], countdown=delay)
    return 'queued'


def _notify_seller(agent, message):
    try:
        key = f"cmt_notify:{agent.id}:{hash(message) % 100000}"
        if not cache.add(key, 1, 600):
            return
        from chat.models import Notification
        Notification.objects.create(user=agent.user, message=message, type='comment_alert')
    except Exception:
        pass


def execute_comment_plan(plan):
    """Perform Graph API actions and write the activity log."""
    from aiAgent.models import AgentAI
    from integrations.services.meta_comments import MetaCommentService

    agent = AgentAI.objects.filter(id=plan['agent_id']).first()
    if not agent:
        return 'no_agent'
    platform = plan['platform']
    payload = plan['payload']
    token = agent.access_token
    comment_id = str(payload.get('comment_id'))

    errors = []
    permission_missing = False
    public_sent = dm_sent = hidden = False

    if plan.get('public_text'):
        ok, err, perm = MetaCommentService.reply_public(platform, token, comment_id, plan['public_text'])
        public_sent = ok
        if not ok:
            errors.append(f"public: {err}")
            permission_missing = permission_missing or perm

    if plan.get('dm_text'):
        ok, err, perm = MetaCommentService.private_reply(token, comment_id, plan['dm_text'])
        dm_sent = ok
        if not ok:
            errors.append(f"dm: {err}")
            permission_missing = permission_missing or perm

    if plan.get('hide'):
        ok, err, perm = MetaCommentService.hide(platform, token, comment_id)
        hidden = ok
        if not ok:
            errors.append(f"hide: {err}")
            permission_missing = permission_missing or perm

    if permission_missing:
        _notify_seller(agent, "কমেন্ট অটোমেশনের জন্য Meta পারমিশন (pages_manage_engagement / instagram comments) প্রয়োজন।")

    attempted = any([plan.get('public_text'), plan.get('dm_text'), plan.get('hide')])
    succeeded = public_sent or dm_sent or hidden
    status = 'done' if (succeeded or not attempted) else 'failed'
    skip_reason = 'permission_required' if permission_missing else plan.get('skip_reason', '')

    _log(
        agent, platform, payload,
        mode_used=plan.get('mode_used', ''), intent=plan.get('intent', ''),
        confidence=plan.get('confidence', 0.0), status=status, skip_reason=skip_reason,
        public_reply_text=plan.get('public_text', ''), public_reply_sent=public_sent,
        dm_text=plan.get('dm_text', ''), dm_sent=dm_sent, hidden=hidden,
        tokens_used=plan.get('tokens_used', 0), error='; '.join(errors)[:1000],
    )
    return status

