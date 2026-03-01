from decimal import Decimal
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from man_agent.models import ReferralRelation


def distribute_agent_commission(subscription):
    print("--- STARTING COMMISSION PROCESS ---")
    user = subscription.profile.user
    payment = subscription.payment
    
    print(f"User: {user.email}, Payment Status: {payment.status if payment else 'No Payment'}")
    
    if not payment or payment.status != 'paid':
        print("ABORTED: Payment is not valid or not paid.")
        return

    try:
        from man_agent.models import ReferralRelation
        # ১. চেক করা এই ইউজার কারো মাধ্যমে জয়েন করেছে কি না
        referral = ReferralRelation.objects.filter(referred_user=user).first()
        
        if not referral:
            print(f"ABORTED: No ReferralRelation found for user {user.email}")
            return

        agent = referral.man_agent
        print(f"AGENT FOUND: {agent.email}")
        
        # ২. সময় চেক (রেজিস্ট্রেশনের ৫ মাসের মধ্যে কি না)
        join_date = referral.joined_at
        cutoff_date = join_date + relativedelta(months=5)
        now = timezone.now()

        print(f"Join Date: {join_date}, Cutoff: {cutoff_date}, Current: {now}")

        if now <= cutoff_date:
            print("TIME CHECK: PASS")
            # ৩. ২০% কমিশন ক্যালকুলেশন
            commission_amount = Decimal(str(payment.amount)) * Decimal('0.20')
            print(f"Calculated Commission: {commission_amount}")

            # ৪. এজেন্টের প্রোফাইল আপডেট
            agent_profile = agent.profile
            print(f"Old Balance: {agent_profile.acount_balance}")
            
            agent_profile.commission_balance += commission_amount
            agent_profile.acount_balance += commission_amount
            agent_profile.save()
            
            # ডাটাবেস থেকে রিফ্রেশ করে কনফার্ম করা
            agent_profile.refresh_from_db()
            print(f"NEW BALANCE SAVED: {agent_profile.acount_balance}")
        else:
            print("TIME CHECK: FAIL (5 months passed)")

    except Exception as e:
        import traceback
        print(f"CRITICAL ERROR: {str(e)}")
        traceback.print_exc() # এটি আপনার টার্মিনালে ডিটেইল এরর দেখাবে
    print("--- ENDING COMMISSION PROCESS ---")