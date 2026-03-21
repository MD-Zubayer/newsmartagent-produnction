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
import uuid
import time


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
        return AgentAI.objects.filter(user=self.request.user).exclude(page_id__startswith='dashboard_').order_by('-created_at')


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
        ).exclude(request_type='dashboard')


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

    # ১. ড্যাশবোর্ড ইউজারের জন্য একটি ভার্চুয়াল এজেন্ট তৈরি বা ব্যবহার করা
    dashboard_page_id = f"dashboard_{user.id}"
    agent_config, created = AgentAI.objects.get_or_create(
        user=user,
        page_id=dashboard_page_id,
        defaults={
            'name': f"Dashboard AI - {user.username}",
            'platform': 'messenger',
            'system_prompt': "You are an expert dashboard assistant for New Smart Agent BD. Help users with their dashboard and account questions.",
            'ai_model': 'models/gemini-1.5-flash',
            'is_active': True
        }
    )

    from settings.models import GlobalSettings
    global_settings = GlobalSettings.get_settings()
    
    if global_settings.dashboard_ai_model:
        model_changed = False
        if agent_config.selected_model_id != global_settings.dashboard_ai_model_id:
            agent_config.selected_model = global_settings.dashboard_ai_model
            agent_config.ai_model = global_settings.dashboard_ai_model.model_id
            model_changed = True
        
        if model_changed or created:
            agent_config.save()

    import uuid
    import time
    from webhooks.tasks import process_ai_reply_task

    msg_id = str(uuid.uuid4())
    DashboardAILog.objects.create(
        user=user,
        message_id=msg_id,
        pathname=path,
        question=message,
        answer="Processing...",
    )

    task_data = {
        'sender_id': str(user.id),
        'page_id': dashboard_page_id,
        'message': message,
        'message_id': msg_id,
        'type': 'dashboard',
        'path': path,
        'timestamp': time.time() * 1000
    }
    
    process_ai_reply_task.delay(task_data)

    return Response({
        'status': 'success',
        'message_id': msg_id,
        'reply': 'processing'
    })



class RankingAPIView(APIView):
    """
    এজেন্টের টপ মেসেজগুলো র‍্যাঙ্কিং অনুযায়ী রিটার্ন করে
    """
    def get(self, request, agent_id, format=None):
        try:
            # ১. ওনারশিপ ভেরিফিকেশন (page_id ব্যবহার করছি)
            agent = AgentAI.objects.filter(page_id=agent_id).first()
            if not agent:
                return Response({"error": "Agent not found"}, status=status.HTTP_404_NOT_FOUND)

            # ২. শেয়ারড এজেন্টদের ডাটা আনা
            shared_agents = agent.get_settings.shared_cache_agents.all()

            def _get_redis_id(a):
                if a.platform == 'web_widget' and a.widget_key:
                    return f"widget_{a.widget_key}"
                return a.page_id

            # ৩. র‍্যাঙ্কিং ডাটা আনা (db=4 থেকে) - নিজের এবং শেয়ারড সব এজেন্টের
            all_raw_messages = {} # msg_hash -> {'frequency': 0, 'is_shared': False, 'origin_agent_id': str}
            
            # ক. নিজের ডাটা
            my_redis_id = _get_redis_id(agent)
            for msg_hash, frequency in get_top_message(my_redis_id, top_n=50):
                all_raw_messages[msg_hash] = {
                    'frequency': int(frequency),
                    'is_shared': False,
                    'origin_agent_id': my_redis_id
                }
                
            # খ. শেয়ারড এজেন্টদের ডাটা
            for s_agent in shared_agents:
                s_redis_id = _get_redis_id(s_agent)
                # শেয়ারড এজেন্টের ক্ষেত্রে আমরা একটু কম টপ মেসেজ নিচ্ছি যাতে ওভারলোড না হয়
                for msg_hash, frequency in get_top_message(s_redis_id, top_n=30):
                    if msg_hash in all_raw_messages:
                        all_raw_messages[msg_hash]['frequency'] += int(frequency)
                    else:
                        all_raw_messages[msg_hash] = {
                            'frequency': int(frequency),
                            'is_shared': True,
                            'origin_agent_id': s_redis_id
                        }

            # ৪. এক্সক্লুশন সেট আনা (শেয়ারিং কন্ট্রোল)
            r_db4 = get_redis_client(db=4)
            
            # নিজের এক্সক্লুশন সেট
            my_exclusion_key = f"agent:{agent_id}:sharing_exclusion_set"
            my_excluded_hashes = r_db4.smembers(my_exclusion_key)
            my_excluded_hashes = {h.decode() if isinstance(h, bytes) else h for h in my_excluded_hashes}
            
            # শেয়ারড এজেন্টদের এক্সক্লুশন সেট প্রি-ফেচ করা
            shared_exclusions = {} # redis_id -> set of hashes
            for s_agent in shared_agents:
                s_id = _get_redis_id(s_agent)
                ex_key = f"agent:{s_id}:sharing_exclusion_set"
                hashes = r_db4.smembers(ex_key)
                shared_exclusions[s_id] = {h.decode() if isinstance(h, bytes) else h for h in hashes}

            ranking_list = []

            # Frequency অনুযায়ী সর্ট করা
            sorted_hashes = sorted(all_raw_messages.items(), key=lambda x: x[1]['frequency'], reverse=True)

            for msg_hash, meta in sorted_hashes:
                frequency = meta['frequency']
                is_shared = meta['is_shared']
                text = "Unknown Message"
                current_scope = 'agent_specific'
                total_token_savings = 0
                is_shareable = True # Default
                
                # ৫. শেয়ারিং স্ট্যাটাস চেক (is_blocked)
                origin_redis_id = meta.get('origin_agent_id', my_redis_id)
                is_blocked = False
                
                if is_shared:
                    # যদি শেয়ারড হয়, তবে অরিজিনাল এজেন্টের সেটিং চেক করো
                    if origin_redis_id in shared_exclusions:
                        if msg_hash in shared_exclusions[origin_redis_id]:
                            is_blocked = True
                            is_shareable = False
                else:
                    # নিজের মেসেজ হলে নিজের সেটিং চেক করো
                    if msg_hash in my_excluded_hashes:
                        is_shareable = False
                
                # Cache checking logic
                cache_key = f"agent:{origin_redis_id}:reply:{msg_hash}"
                raw_data = redis_conn.get(cache_key)
                source = 'shared_agent' if is_shared else 'agent'
                
                # যদি অরিজিন এজেন্টের ক্যাশে না থাকে, তবে অন্য সব শেয়ারড এজেন্টদের ক্যাশে খুঁজো
                if not raw_data:
                    # ১. নিজেরটা চেক করো (যদি origin কোনো শেয়ারড এজেন্ট হয়)
                    if origin_redis_id != my_redis_id:
                        my_cache_key = f"agent:{my_redis_id}:reply:{msg_hash}"
                        raw_data = redis_conn.get(my_cache_key)
                        if raw_data: source = 'agent'

                    # ২. সব শেয়ারড এজেন্টদের ক্যাশে খুঁজো (এটি সব সময় করা হবে যেন Unknown Message না আসে)
                    if not raw_data:
                        for s_agent in shared_agents:
                            s_redis_id = _get_redis_id(s_agent)
                            if s_redis_id == origin_redis_id: continue
                            s_cache_key = f"agent:{s_redis_id}:reply:{msg_hash}"
                            raw_data = redis_conn.get(s_cache_key)
                            if raw_data:
                                source = 'shared_agent'
                                break
                
                # যদি DB 2-তে না থাকে তবে DB 6 (Global Cache) চেক করা
                if not raw_data:
                    global_key = f"global:reply:{msg_hash}"
                    raw_data = r_grouped.get(global_key)
                    source = 'global'
                
                # যদি Global-এও না থাকে তবে DB 6 (Sender Specific) চেক করা
                if not raw_data:
                    # নিজের sender pattern
                    sender_pattern = f"agent:{my_redis_id}:sender:*:reply:{msg_hash}"
                    for s_key in r_grouped.scan_iter(match=sender_pattern, count=1):
                        raw_data = r_grouped.get(s_key)
                        if raw_data:
                            source = 'sender_specific'
                            break

                if raw_data:
                    try:
                        data = json.loads(raw_data)
                        text = data.get('original_text', data.get('original_normalized', 'Unknown Message'))
                        
                        if source == 'agent' or source == 'shared_agent':
                            current_scope = data.get('cache_scope', 'agent_specific')
                        elif source == 'global':
                            current_scope = 'global'
                        else:
                            current_scope = 'sender_specific'
                        
                        input_tokens = data.get('input_tokens', 0)
                        output_tokens = data.get('output_tokens', 0)
                        
                        # Token Savings Calculation Refinement:
                        # If a message is from a shared or global source, it means 1 AI call was shared.
                        # Global savings = (Total Aggregated Frequency - 1) * cost_per_query
                        total_token_savings = (int(input_tokens) + int(output_tokens)) * (int(frequency) - 1)
                        if total_token_savings < 0: total_token_savings = 0
                    except:
                        pass

                is_shareable = msg_hash not in my_excluded_hashes

                ranking_list.append({
                    'text': text,
                    'frequency': int(frequency),
                    'token_savings': total_token_savings,
                    'msg_hash': msg_hash,
                    'current_scope': current_scope,
                    'is_shareable': is_shareable,
                    'is_shared': is_shared,
                    'is_blocked': is_blocked,
                })

            return Response({
                "data": ranking_list,
                "is_staff": request.user.is_staff or request.user.is_superuser,
                "is_special_agent": agent.is_special_agent,
                "special_agent_status": agent.special_agent_status,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ToggleSharingAPIView(APIView):
    """
    মেসেজের শেয়ারিং স্ট্যাটাস (On/Off) পরিবর্তন করে।
    এটি Redis set 'agent:{agent_id}:sharing_exclusion_set'-এ msg_hash যোগ বা রিমুভ করে।
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request, agent_id, msg_hash):
        try:
            # ১. ওনারশিপ ভেরিফিকেশন
            agent = AgentAI.objects.filter(page_id=agent_id, user=request.user).first()
            if not agent:
                return Response({"error": "Agent not found or unauthorized"}, status=status.HTTP_404_NOT_FOUND)
            
            is_shareable = request.data.get('is_shareable', True)
            
            r_db4 = get_redis_client(db=4)
            exclusion_key = f"agent:{agent_id}:sharing_exclusion_set"
            
            if is_shareable:
                # শেয়ারযোগ্য হলে এক্সক্লুশন লিস্ট থেকে রিমুভ করো
                r_db4.srem(exclusion_key, msg_hash)
                msg = "Message marked as shareable"
            else:
                # শেয়ারযোগ্য না হলে এক্সক্লুশন লিস্টে অ্যাড করো
                r_db4.sadd(exclusion_key, msg_hash)
                msg = "Message excluded from sharing"
                
            return Response({"status": "success", "message": msg, "is_shareable": is_shareable}, status=status.HTTP_200_OK)
            
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
            
            # ৫. গ্লোবাল ক্যাশ (DB 6) থেকে রিমুভ করা (শুধুমাত্র স্টাফ মেম্বার বা ওনারের জন্য - ওনাররা কেবল তাদের ওন করা ডাটা ক্লিয়ার করবে, তবে গ্লোবাল ক্লিয়ারেন্স স্টাফের হাতে থাকাই নিরাপদ)
            # তবে ইউজার যদি স্টাফ হয় তবে আমরা গ্লোবাল থেকেও মুছে দেব যাতে রি-জেনারেশন হয়।
            if request.user.is_staff or request.user.is_superuser:
                global_key = f"global:reply:{msg_hash}"
                r_grouped_db6.delete(global_key)
            
            return Response({"status": "success", "message": "Message deleted from cache layers"}, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ClearGlobalCacheAPIView(APIView):
    """
    পুরো গ্লোবাল ক্যাশ ডিলিট করার জন্য (শুধুমাত্র স্টাফদের জন্য)
    """
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"error": "Only staff members can clear global cache."}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            from .cache.hybrid_similarity import clear_global_cache
            count = clear_global_cache()
            return Response({"status": "success", "message": f"Successfully cleared {count} global cache entries"}, status=status.HTTP_200_OK)
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
            sender_keys_to_delete = []
            
            if not raw_data:
                sender_pattern = f"agent:{agent_id}:sender:*:reply:{msg_hash}"
                for s_key in r_db6.scan_iter(match=sender_pattern):
                    raw_data = r_db6.get(s_key)
                    if raw_data:
                        for key in r_db6.scan_iter(match=sender_pattern):
                            sender_keys_to_delete.append(key)
                        break

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
                if sender_keys_to_delete:
                    for k in sender_keys_to_delete: r_db6.delete(k)
            elif new_scope == 'special':
                # Special Scope (Requires agent to be special)
                if not agent.is_special_agent:
                    return Response({"error": "This agent is not enrolled in the Special Agent program."}, status=status.HTTP_403_FORBIDDEN)
                
                # DB 2 (same as agent) but 1 year TTL
                r_db2.set(agent_key, json.dumps(data), ex=365*24*60*60) 
                r_db6.delete(global_key)
                if sender_keys_to_delete:
                    for k in sender_keys_to_delete: r_db6.delete(k)
            else:
                # Global -> Agent
                # ১. এজেন্টে সেভ করা
                r_db2.set(agent_key, json.dumps(data), ex=14*24*60*60) # 14 days
                
                # ২. গ্লোবাল থেকে ডিলিট করা
                r_db6.delete(global_key)
                if sender_keys_to_delete:
                    for k in sender_keys_to_delete: r_db6.delete(k)
                
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
