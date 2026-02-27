from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from aiAgent.models import AgentAI, TokenUsageLog, DashboardAILog
from aiAgent.serializers import AgentAISerializer, AgentAIListSerializer, TokenUsageAnalyticsSerializer
from rest_framework.views import APIView
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg, Q
from django.db.models.functions import TruncDate
from aiAgent.gemini import generate_dashboard_help
from rest_framework.decorators import api_view, permission_classes
from django.http import JsonResponse
from aiAgent.cache.ranking import get_top_message
from aiAgent.cache.hybrid_similarity import r as redis_conn
import json


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
        start_date = today - timedelta(days=30)

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
        
        
        
        
# ড্যাশবোর্ড পেজ অনুযায়ী ডকুমেন্টেশন (এটি ভিউতে রাখাই ভালো)
PAGE_DOCS = {
    "/dashboard/user": "এটি ইউজার ড্যাশবোর্ড। এখান থেকে প্রোফাইল এবং ব্যালেন্স দেখা যায়।",
    "/dashboard/agent": "এখানে নতুন এজেন্ট ক্রিয়েট করা হয়। এজেন্ট আইডি ইউনিক হতে হবে।",
    "/dashboard/settings": "এখান থেকে পাসওয়ার্ড এবং সিকিউরিটি আপডেট করা যায়।",
    "default": "আমি আপনার ড্যাশবোর্ড হেল্পার। যেকোনো সমস্যায় আমাকে জিজ্ঞাসা করুন।"
}

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def dashboard_chat_view(request):
    user = request.user
    message = request.data.get('message')
    path = request.data.get('path', '/dashboard')

    if not message:
        return Response({'reply': 'মেসেজ খালি পাঠানো যাবে না।'}, status=400)

    # ১. পাথ অনুযায়ী সঠিক কনটেক্সট খুঁজে বের করা
    context = PAGE_DOCS.get(path, PAGE_DOCS["default"])

    # ২. আপনার gemini.py এর ফাংশনটি কল করা
    ai_response = generate_dashboard_help(
        user_query=message,
        page_context=context,
        chat_history=[] # আপনি চাইলে ডাটাবেস থেকে লাস্ট ৫টি চ্যাট এখানে পাঠাতে পারেন
    )

    if ai_response['status'] == 'success':
        # ৩. ডাটাবেসে লগ সেভ করা
        DashboardAILog.objects.create(
            user=user,
            pathname=path,
            question=message,
            answer=ai_response['reply'],
            input_tokens=ai_response.get('input_tokens', 0),
            output_tokens=ai_response.get('output_tokens', 0),
            total_tokens=ai_response.get('total_tokens', 0)
        )
        return Response({'reply': ai_response['reply']})
    
    return Response({'reply': 'দুঃখিত, এআই এই মুহূর্তে উত্তর দিতে পারছে না।'}, status=500)



class RankingAPIView(APIView):
    """
    এজেন্টের টপ মেসেজগুলো র‍্যাঙ্কিং অনুযায়ী রিটার্ন করে
    """
    def get(self, request, agent_id, format=None):
        try:
            # ১. র‍্যাঙ্কিং ডাটা আনা (db=6 থেকে)
            top_messages_raw = get_top_message(agent_id, top_n=10)
            
            api_data = []
            
            # ২. hash থেকে মূল টেক্সট খুঁজে বের করা (db=2 থেকে)
            for msg_hash, frequency in top_messages_raw:
                key = f"agent:{agent_id}:reply:{msg_hash.decode()}"
                cached_data = redis_conn.get(key)
                
                text = "Unknown Message"
                total_token_savings = 0 # 👈 ভেরিয়েবলটি ইনিশিয়ালাইজ করুন
                
                if cached_data:
                    data = json.loads(cached_data)
                    text = data.get('original_normalized', 'Unknown Message') 
                    
                    input_tokens = data.get('input_tokens', 0)
                    output_tokens = data.get('output_tokens', 0)
                    # ⚡ ক্যালকুলেশন ঠিক আছে
                    total_token_savings = (int(input_tokens) + int(output_tokens)) * int(frequency)
                    total_token_savings -= input_tokens + output_tokens

                api_data.append({
                    'text': text,
                    'frequency': int(frequency),
                    'token_savings': total_token_savings, # 👈 এখানে ভেরিয়েবলের নাম ঠিক করুন
                })

            return Response(api_data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
