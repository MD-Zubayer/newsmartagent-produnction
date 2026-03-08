from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Sum
from datetime import timedelta
from django.utils.translation import gettext_lazy as _

from aiAgent.models import AgentAI, TokenUsageLog, DashboardAILog

User = get_user_model()

def dashboard_callback(request, context):
    print("🔥 DASHBOARD CALLBACK RUNNING")
    total_users = User.objects.count()

    total_agents = AgentAI.objects.count()
    active_agents = AgentAI.objects.filter(is_active=True).count()

    last_24h = timezone.now() - timedelta(hours=24)

    total_tokens_24h = TokenUsageLog.objects.filter(
        created_at__gte=last_24h
    ).aggregate(total=Sum('total_tokens'))['total'] or 0

    total_ai_queries = DashboardAILog.objects.count()

    context.update({
        "custom_stats": [
            {
                "title": _("Total Clients"),
                "metric": total_users,
                "footer": _("System-wide registered users"),
                "icon": "group",
            },
            {
                "title": _("Active AI Agents"),
                "metric": f"{active_agents}/{total_agents}",
                "footer": _("Agents currently responding live"),
                "icon": "smart_toy",
            },
            {
                "title": _("Tokens (24h)"),
                "metric": f"{total_tokens_24h:,}",
                "footer": _("Tokens consumed in last 24 hours"),
                "icon": "database",
            },
            {
                "title": _("AI Interactions"),
                "metric": total_ai_queries,
                "footer": _("Total queries handled by Dashboard AI"),
                "icon": "forum",
            },
        ],
    })

    return context