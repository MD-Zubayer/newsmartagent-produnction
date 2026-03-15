from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from aiAgent.models import AgentAI, TokenUsageLog, DashboardAILog, AIProviderModel
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
from aiAgent.cache.hybrid_similarity import r as redis_conn, r_grouped
from aiAgent.cache.metrics import get_metrics
from aiAgent.cache.client import get_redis_client
import json
from users.models import Subscription
from .serializers import AIProviderModelSerializer


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


class UserAvailableModelsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # ১. ইউজারের সকল একটিভ সাবস্ক্রিপশনের অফার আইডিগুলো বের করা
        active_offer_ids = Subscription.objects.filter(
            profile__user=request.user,
            is_active=True
        ).values_list('offer_id', flat=True)

        if not active_offer_ids:
            return Response({
                "status": "no_active_plan",
                "message": "You don't have any active subscription.",
                "models": []
            }, status=200)

        # ২. এখানে 'offers__id__in' ব্যবহার করতে হবে কারণ related_name='offers'
        allowed_models = AIProviderModel.objects.filter(
            offers__id__in=active_offer_ids, 
            is_active=True
        ).distinct()

        serializer = AIProviderModelSerializer(allowed_models, many=True)

        return Response({
            "status": "success",
            "plan_count": len(active_offer_ids),
            "models": serializer.data
        })

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
            all_tokens=Sum('total_tokens'),
            input_tokens=Sum('input_tokens'),
            output_tokens=Sum('output_tokens'),
            total_reqs=Count('id'),
            failed_reqs=Count('id', filter=Q(success=False)),
            avg_resp=Avg('response_time'),
            memory_tokens=Sum('total_tokens', filter=Q(request_type='memory_extraction'))
        )

        total = summary_stats['all_tokens'] or 0
        total_msgs = summary_stats['total_reqs'] or 0
        failed = summary_stats['failed_reqs'] or 0
        memory_used = summary_stats['memory_tokens'] or 0


        summary = {
            "total_tokens": total,
            "input_tokens": summary_stats["input_tokens"] or 0,   
            "output_tokens": summary_stats["output_tokens"] or 0,
            "total_messages": total_msgs,
            "success_rate": round(((total - failed) / total * 100), 1) if total > 0 else 0,
            "avg_response_ms": round(summary_stats["avg_resp"] or 0),

            "failed_count": failed,
            "memory_extraction_tokens": memory_used
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
            # ১. র‍্যাঙ্কিং ডাটা আনা (db=4 থেকে)
            top_messages_raw = get_top_message(agent_id, top_n=10)
            agent = AgentAI.objects.filter(page_id=agent_id).first()
            is_special_agent = agent.is_special_agent if agent else False
            
            api_data = []
            
            # ২. hash থেকে মূল টেক্সট খুঁজে বের করা
            for msg_hash, frequency in top_messages_raw:
                # DB 2 (Agent Cache) চেক করা
                key = f"agent:{agent_id}:reply:{msg_hash}"
                cached_data = redis_conn.get(key)
                source = 'agent'
                
                # যদি DB 2-তে না থাকে তবে DB 6 (Global Cache) চেক করা
                if not cached_data:
                    global_key = f"global:reply:{msg_hash}"
                    cached_data = r_grouped.get(global_key)
                    source = 'global'

                text = "Unknown Message"
                total_token_savings = 0
                current_scope = "agent_specific"
                
                if cached_data:
                    data = json.loads(cached_data)
                    text = data.get('original_normalized', data.get('original_text', 'Unknown Message')) 
                    current_scope = data.get('cache_scope', 'agent_specific') if source == 'agent' else 'global'
                    
                    input_tokens = data.get('input_tokens', 0)
                    output_tokens = data.get('output_tokens', 0)
                    # ⚡ ক্যালকুলেশন
                    total_token_savings = (int(input_tokens) + int(output_tokens)) * int(frequency)
                    total_token_savings -= (input_tokens + output_tokens)

                api_data.append({
                    'text': text,
                    'frequency': int(frequency),
                    'token_savings': total_token_savings,
                    'msg_hash': msg_hash,
                    'current_scope': current_scope,
                })

            return Response({
                "data": api_data,
                "is_staff": request.user.is_staff or request.user.is_superuser,
                "is_special_agent": is_special_agent
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class AgentMetricsAPIView(APIView):
    """
    এজেন্টের পারফরম্যান্স মেট্রিক্স রিটার্ন করে (Cache Hit/Miss etc.)
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, agent_id):
        try:
            raw_metrics = get_metrics(agent_id)
            # বাইটস থেকে ডিকোড করা
            metrics = {k.decode(): v.decode() for k, v in raw_metrics.items()}
            
            # Hit Rate ক্যালকুলেশন
            hits = int(metrics.get('cache_hit', 0))
            misses = int(metrics.get('cache_miss', 0))
            total = hits + misses
            hit_rate = round((hits / total * 100), 2) if total > 0 else 0
            
            return Response({
                "status": "success",
                "metrics": metrics,
                "hit_rate": hit_rate,
                "total_queries": total
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DeleteRankingDataAPIView(APIView):
    """
    এজেন্টের নির্দিষ্ট মেসেজ ক্যাশ এবং র‍্যাঙ্কিং থেকে ডিলিট করে
    """
    permission_classes = [IsAuthenticated]
    
    def delete(self, request, agent_id, msg_hash):
        try:
            # ১. ওনারশিপ ভেরিফিকেশন (নিরাপত্তার জন্য - page_id ব্যবহার করছি কারণ ফ্রন্টএন্ড এটাই পাঠায়)
            agent = AgentAI.objects.filter(page_id=agent_id, user=request.user).first()
            if not agent:
                return Response({"error": "Agent not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
            # ২. র‍্যাঙ্কিং ও ক্লাস্টার (DB 4) থেকে রিমুভ করা
            ranking_r = get_redis_client(db=4)
            ranking_key = f"agent:{agent_id}:ranking"
            cluster_key = f"agent:{agent_id}:clusters"
            
            pipe_db4 = ranking_r.pipeline()
            pipe_db4.zrem(ranking_key, msg_hash)
            pipe_db4.hdel(cluster_key, msg_hash)
            pipe_db4.execute()
            
            # ৩. এজেন্ট ক্যাশ (DB 2) থেকে ডিলিট করা
            cache_key = f"agent:{agent_id}:reply:{msg_hash}"
            redis_conn.delete(cache_key)
            
            # ৪. সেন্ডার ক্যাশ (DB 6) থেকে ডিলিট করা (নির্দিষ্ট এজেন্টের জন্য)
            r_grouped_db6 = get_redis_client(db=6)
            
            # Sender-specific keys for this agent and this message hash
            sender_pattern = f"agent:{agent_id}:sender:*:reply:{msg_hash}"
            for key in r_grouped_db6.scan_iter(match=sender_pattern):
                r_grouped_db6.delete(key)
            
            return Response({"status": "success", "message": "Message deleted from agent cache layers"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class UpdateCacheScopeAPIView(APIView):
    """
    মেসেজের ক্যাশ গ্রুপ (Scope) পরিবর্তন করে (Agent Specific <-> Global)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, agent_id, msg_hash):
        new_scope = request.data.get('new_scope') # 'global', 'agent_specific' or 'special'
        if new_scope not in ['global', 'agent_specific', 'special']:
            return Response({"error": "Invalid scope. Use 'global', 'agent_specific' or 'special'"}, status=status.HTTP_400_BAD_REQUEST)

        # ১. পারমিশন চেক (শুধু স্টাফরা পারবে)
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Only staff members can change cache group."}, status=status.HTTP_403_FORBIDDEN)

        try:
            # ১. ওনারশিপ ভেরিফিকেশন
            agent = AgentAI.objects.filter(page_id=agent_id, user=request.user).first()
            if not agent:
                return Response({"error": "Agent not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
            # ২. সোর্স ডাটা চেক করা (উভয় ডিবিতে চেক করবে)
            agent_key = f"agent:{agent_id}:reply:{msg_hash}"
            global_key = f"global:reply:{msg_hash}"
            
            r_db2 = redis_conn # DB 2
            r_db6 = get_redis_client(db=6) # DB 6
            
            raw_data = r_db2.get(agent_key) or r_db6.get(global_key)
            if not raw_data:
                return Response({"error": "Original cached message not found"}, status=status.HTTP_404_NOT_FOUND)
            
            data = json.loads(raw_data)
            
            # ৩. ডাটা আপডেট করা
            data['cache_scope'] = new_scope
            
            # ৪. মুভ করা
            if new_scope == 'global':
                # Agent -> Global
                r_db6.set(global_key, json.dumps(data), ex=30*24*60*60) # 30 days
                r_db2.delete(agent_key)
            elif new_scope == 'special':
                # Special Scope (Requires agent to be special)
                if not agent.is_special_agent:
                    return Response({"error": "This agent is not enrolled in the Special Agent program."}, status=status.HTTP_403_FORBIDDEN)
                
                # DB 2 (same as agent) but 1 year TTL
                r_db2.set(agent_key, json.dumps(data), ex=365*24*60*60) 
                r_db6.delete(global_key)
            else:
                # Global -> Agent
                # ১. এজেন্টে সেভ করা
                r_db2.set(agent_key, json.dumps(data), ex=14*24*60*60) # 14 days
                
                # ২. গ্লোবাল থেকে ডিলিট করা
                r_db6.delete(global_key)
                
            return Response({"status": "success", "message": f"Cache scope updated to {new_scope}"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class RequestSpecialAgentAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, agent_id):
        try:
            agent = AgentAI.objects.filter(page_id=agent_id, user=request.user).first()
            if not agent:
                return Response({"error": "Agent not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
            if agent.is_special_agent or agent.special_agent_status == 'approved':
                return Response({"error": "This agent is already a Special Agent."}, status=status.HTTP_400_BAD_REQUEST)
            
            if agent.special_agent_status == 'pending':
                return Response({"error": "Your request is already pending approval."}, status=status.HTTP_400_BAD_REQUEST)

            # Update the status to pending
            agent.special_agent_status = 'pending'
            agent.save()

            return Response({
                "status": "success", 
                "message": "Special Agent request submitted successfully. Please wait for admin approval."
            }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
