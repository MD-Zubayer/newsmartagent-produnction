from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from aiAgent.models import AgentAI, TokenUsageLog
from aiAgent.serializers import AgentAISerializer, AgentAIListSerializer, TokenUsageAnalyticsSerializer
from rest_framework.views import APIView
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDate

# Create your views here.


class AgentAIViewSet(viewsets.ModelViewSet):

    queryset = AgentAI.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):

        """
        Determines which serializer to use for which action
        """
        if self.action in ['create', 'update', 'partial_update']:
            return AgentAISerializer
        return AgentAIListSerializer

    def perform_create(self, serializer):
        """
        Automatically add the currently logged in user when creating a new Agent,
        Saving data about the user from the request
        """
        serializer.save(user=self.request.user)

    def get_queryset(self):

        """_summary_ 
        Returning only the current user's agents
        This ensures that user 1 cannot see user 2's data.
        """
        return AgentAI.objects.filter(user=self.request.user).order_by('-created_at')

    

class TokenUsageAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):

        today = timezone.now().date()
        start_date = today - timedelta(days=7)

        # <! -------- Setting the base query -------------!>

        user_logs = TokenUsageLog.objects.filter(
            user=request.user,
            created_at__date__gte=start_date
        )


        #<!------------- 1. Daily Trend (Line Chart) --------------!>

        usage_trend = (
            user_logs.filter(success=True)
            .annotate(date=TruncDate('created_at'))
            .values("date")
            .annotate(
                total_tokens=Sum("total_tokens"),
                input_tokens=Sum('input_tokens'),
                output_tokens=Sum('output_tokens'),
                message_count=Count("id",)
            )
            .order_by('date')
        )

        #<!---------------- 2. Model and Platform Distribution (Pie/Donut Charts) ---------------!>

        model_dist = user_logs.values('model_name').annotate(count=Count('id'))
        platform_dist = user_logs.values('platform').annotate(count=Count("id"))

        # <!------------- 3. Summary Stats ----------------!>

        summary_stats = user_logs.aggregate(
            total_tokens=Sum('total_tokens'),
            input_tokens=Sum('input_tokens'),
            output_tokens=Sum('output_tokens'),
            total_reqs=Count('id'),
            failed_reqs=Count('id', filter=Q(success=False)),
            avg_resp=Avg('response_time'),
        )

        total = summary_stats['total_tokens'] or 0
        total_msgs = summary_stats['total_reqs'] or 0
        failed = summary_stats['failed_reqs'] or 0


        summary = {
            "total_tokens": summary_stats["total_tokens"] or 0,
            "input_tokens": summary_stats["input_tokens"] or 0,   
            "output_tokens": summary_stats["output_tokens"] or 0,
            "total_messages": total_msgs,
            "success_rate": round(((total - failed) / total * 100), 1) if total > 0 else 0,
            "avg_response_ms": round(summary_stats["avg_resp"] or 0),
            "failed_count": failed
        }


        #<!------------------- 4. Recent Logs (Table) ---------------!>

        recent_logs = user_logs.order_by("-created_at")[:20]
        serializer = TokenUsageAnalyticsSerializer(recent_logs, many=True)

        return Response({
            "status": "success",
            "summary": summary,
            "charts": {
                "usage_trend": list(usage_trend),
                "model_distribution": list(model_dist),
                "platform_distribution": list(platform_dist)
            },
            "recent_logs": serializer.data
        })