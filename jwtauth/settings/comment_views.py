from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from aiAgent.models import AgentAI
from .models import CommentAutomationSettings, CommentActivityLog, PostContextNote

COMMENT_PLATFORMS = ['messenger', 'facebook_comment', 'instagram']

EDITABLE_FIELDS = [
    'mode', 'public_reply_enabled', 'private_dm_enabled', 'hide_spam_enabled',
    'reply_to_nested', 'fixed_templates', 'fixed_dm_template', 'reply_delay_min',
    'reply_delay_max', 'hourly_reply_limit', 'daily_ai_comment_limit',
    'low_balance_threshold', 'confidence_threshold', 'hide_confidence_threshold',
    'only_post_ids', 'is_active',
]


def _owner(request):
    user = request.user
    return user.get_workspace_owner() if hasattr(user, 'get_workspace_owner') else user


def _serialize_settings(cfg):
    if not cfg:
        return None
    data = {f: getattr(cfg, f) for f in EDITABLE_FIELDS}
    data['id'] = cfg.id
    return data


def _agent_or_404(request, agent_id):
    return AgentAI.objects.filter(
        id=agent_id, user=_owner(request), platform__in=COMMENT_PLATFORMS
    ).first()


def _clean(data):
    """Validate and coerce incoming settings. Returns (clean_dict, error)."""
    clean = {}
    mode = data.get('mode')
    if mode is not None:
        if mode not in ('off', 'fixed', 'ai', 'hybrid'):
            return None, 'Invalid mode.'
        clean['mode'] = mode

    for key in ('public_reply_enabled', 'private_dm_enabled', 'hide_spam_enabled',
                'reply_to_nested', 'is_active'):
        if key in data:
            clean[key] = bool(data[key])

    int_limits = {
        'reply_delay_min': (0, 600), 'reply_delay_max': (0, 600),
        'hourly_reply_limit': (1, 2000), 'daily_ai_comment_limit': (0, 20000),
        'low_balance_threshold': (0, 100000000),
    }
    for key, (lo, hi) in int_limits.items():
        if key in data:
            try:
                clean[key] = max(lo, min(hi, int(data[key])))
            except (TypeError, ValueError):
                return None, f'Invalid {key}.'

    for key in ('confidence_threshold', 'hide_confidence_threshold'):
        if key in data:
            try:
                clean[key] = max(0.0, min(1.0, float(data[key])))
            except (TypeError, ValueError):
                return None, f'Invalid {key}.'

    if 'fixed_templates' in data:
        tpls = data['fixed_templates']
        if not isinstance(tpls, list):
            return None, 'fixed_templates must be a list.'
        clean['fixed_templates'] = [str(t).strip()[:300] for t in tpls if str(t).strip()][:10]

    if 'fixed_dm_template' in data:
        clean['fixed_dm_template'] = str(data['fixed_dm_template'] or '').strip()[:500]

    if 'only_post_ids' in data:
        ids = data['only_post_ids']
        if not isinstance(ids, list):
            return None, 'only_post_ids must be a list.'
        clean['only_post_ids'] = [str(i).strip() for i in ids if str(i).strip()][:200]

    return clean, None


class CommentAutomationListView(APIView):
    """GET /api/settings/comment-automation/ — the seller's FB/IG agents with their comment settings."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        agents = AgentAI.objects.filter(
            user=_owner(request), platform__in=COMMENT_PLATFORMS, is_active=True
        ).exclude(page_id__startswith='dashboard_').select_related('comment_settings').order_by('id')
        result = []
        for agent in agents:
            cfg = getattr(agent, 'comment_settings', None)
            result.append({
                'agent_id': agent.id,
                'name': agent.name or agent.page_id,
                'platform': 'instagram' if agent.platform == 'instagram' else 'facebook',
                'page_id': agent.page_id,
                'configured': bool(cfg),
                'settings': _serialize_settings(cfg),
            })
        return Response(result)


class CommentAutomationDetailView(APIView):
    """PUT /api/settings/comment-automation/<agent_id>/ — create/update settings."""
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, agent_id):
        agent = _agent_or_404(request, agent_id)
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        clean, error = _clean(request.data)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)
        cfg, _ = CommentAutomationSettings.objects.get_or_create(agent=agent)
        for key, value in clean.items():
            setattr(cfg, key, value)
        if cfg.reply_delay_min > cfg.reply_delay_max:
            cfg.reply_delay_min, cfg.reply_delay_max = cfg.reply_delay_max, cfg.reply_delay_min
        cfg.save()
        return Response(_serialize_settings(cfg))

    def delete(self, request, agent_id):
        """Remove settings so the agent returns to the legacy comment behaviour."""
        agent = _agent_or_404(request, agent_id)
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        CommentAutomationSettings.objects.filter(agent=agent).delete()
        return Response({'status': 'removed'})


class CommentActivityLogView(APIView):
    """GET /api/settings/comment-automation/logs/?agent_id=&status=&limit="""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        agents = AgentAI.objects.filter(user=_owner(request), platform__in=COMMENT_PLATFORMS)
        qs = CommentActivityLog.objects.filter(agent__in=agents)
        agent_id = request.query_params.get('agent_id')
        if agent_id and str(agent_id).isdigit():
            qs = qs.filter(agent_id=int(agent_id))
        st = request.query_params.get('status')
        if st in ('done', 'review', 'skipped', 'failed'):
            qs = qs.filter(status=st)
        try:
            limit = max(1, min(200, int(request.query_params.get('limit', 50))))
        except ValueError:
            limit = 50

        today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_qs = CommentActivityLog.objects.filter(agent__in=agents, created_at__gte=today)
        stats = today_qs.aggregate(
            total=Count('id'),
            replied=Count('id', filter=Q(public_reply_sent=True)),
            dm=Count('id', filter=Q(dm_sent=True)),
            hidden=Count('id', filter=Q(hidden=True)),
            review=Count('id', filter=Q(status='review')),
            failed=Count('id', filter=Q(status='failed')),
            tokens=Sum('tokens_used'),
        )
        stats = {k: (v or 0) for k, v in stats.items()}

        logs = [{
            'id': l.id, 'agent_id': l.agent_id, 'platform': l.platform,
            'comment_id': l.comment_id, 'post_id': l.post_id,
            'commenter_name': l.commenter_name, 'comment_text': l.comment_text,
            'mode_used': l.mode_used, 'intent': l.intent, 'confidence': l.confidence,
            'status': l.status, 'skip_reason': l.skip_reason,
            'public_reply_text': l.public_reply_text, 'public_reply_sent': l.public_reply_sent,
            'dm_text': l.dm_text, 'dm_sent': l.dm_sent, 'hidden': l.hidden,
            'tokens_used': l.tokens_used, 'error': l.error,
            'created_at': l.created_at.isoformat(),
        } for l in qs[:limit]]
        return Response({'stats': stats, 'logs': logs})


class PostContextNoteView(APIView):
    """POST /api/settings/comment-automation/post-notes/ — free manual context for a post/video."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        agent = _agent_or_404(request, request.query_params.get('agent_id'))
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        notes = PostContextNote.objects.filter(agent=agent).order_by('-updated_at')[:100]
        return Response([{'post_id': n.post_id, 'note': n.note} for n in notes])

    def post(self, request):
        agent = _agent_or_404(request, request.data.get('agent_id'))
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        post_id = str(request.data.get('post_id') or '').strip()
        note = str(request.data.get('note') or '').strip()[:500]
        if not post_id or not note:
            return Response({'error': 'post_id and note are required.'}, status=status.HTTP_400_BAD_REQUEST)
        obj, _ = PostContextNote.objects.update_or_create(
            agent=agent, post_id=post_id, defaults={'note': note}
        )
        from django.core.cache import cache
        for platform in ('facebook', 'instagram'):
            cache.delete(f"cmt_post_ctx:{platform}:{post_id}")
        return Response({'post_id': obj.post_id, 'note': obj.note})

    def delete(self, request):
        agent = _agent_or_404(request, request.query_params.get('agent_id'))
        if not agent:
            return Response({'error': 'Agent not found.'}, status=status.HTTP_404_NOT_FOUND)
        PostContextNote.objects.filter(
            agent=agent, post_id=str(request.query_params.get('post_id') or '')
        ).delete()
        return Response({'status': 'removed'})

