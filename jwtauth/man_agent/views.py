from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from man_agent.models import ManAgentConfig, ReferralRelation
from man_agent.serializer import ManAgentConfigSerializer, ReferredUserSerializer
from users.models import Subscription, Payment
from django.db.models import Max, Q
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from decimal import Decimal
# Create your views here.



class ManAgentConfigViewSet(viewsets.ModelViewSet):

    permission_classes = [IsAuthenticated]
    serializer_class = ManAgentConfigSerializer

    def get_queryset(self):
        return ManAgentConfig.objects.filter(man_agent=self.request.user)

    def perform_create(self, serializer):
        serializer.save(man_agent=self.request.user)



class AgentDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = user.profile
        config = ManAgentConfig.objects.filter(man_agent=user).first()

        # ১. এজেন্টের মাধ্যমে জয়েন করা সব ইউজার আইডি
        referrals = ReferralRelation.objects.filter(man_agent=user).select_related('referred_user')
        referred_user_ids = referrals.values_list('referred_user_id', flat=True)

        # ২. লজিক আপডেট: প্রতিটি ইউজারের শুধুমাত্র লেটেস্ট সাবস্ক্রিপশনটি বের করা
        # এটি ডুপ্লিকেট কাউন্ট রোধ করবে
        latest_subs_ids = Subscription.objects.filter(
            profile__user_id__in=referred_user_ids
        ).values('profile__user_id').annotate(
            latest_id=Max('id')
        ).values_list('latest_id', flat=True)

        latest_subs = Subscription.objects.filter(id__in=latest_subs_ids)
        
        # ৩. সঠিক সংখ্যা গণনা
        active_subs_count = latest_subs.filter(is_active=True).count()
        total_unique_subs_count = latest_subs.count() # কতজন ইউজার অন্তত একবার সাবস্ক্রিপশন নিয়েছে
        inactive_subs_count = total_unique_subs_count - active_subs_count

        # ৪. ৫ মাসের কমিশন ফোরকাস্ট লজিক
        # বর্তমান কমিশন ব্যালেন্সকেই মাসিক গতি ধরে পরের ৫ মাস সমান রাখছি
        monthly_commission = Decimal(profile.commission_balance or 0)
        forecast = [round(monthly_commission, 2) for _ in range(5)]

        data = {
            'total_referrals': referrals.count(),
            'otp_key': config.otp_key if config else 'N/A',
            'is_otp_active': config.is_active if config else False,
            'commission_balance': profile.commission_balance,
            'acount_balance': profile.acount_balance,
            
            # আপডেট করা ডাটা পয়েন্ট
            'total_subscriptions': total_unique_subs_count,
            'active_subscriptions': active_subs_count,
            'inactive_subscriptions': inactive_subs_count,
            'monthly_forecast': forecast,
            
            # রেফারেল লিস্ট (Serializer এখন শুধু লেটেস্ট স্ট্যাটাস দেখাবে)
            'recent_users': ReferredUserSerializer(
                [r.referred_user for r in referrals.order_by('-id')], 
                many=True
            ).data
        }
        
        return Response(data)
