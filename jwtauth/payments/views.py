from django.shortcuts import render
from decimal import Decimal
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import viewsets
from users.models import User, Profile, Payment, Subscription, Offer
from users.serializers import  OfferSerializer, SubscriptionSerializer
from payments.serializers import PaymentSerializer
from rest_framework import status
from rest_framework.views import APIView
from datetime import datetime, timedelta, timezone
from django.conf import settings
from users.authentication import CookieJWTAuthentication
from rest_framework.exceptions import ValidationError
from django.utils.timezone import now
from django.db import transaction

# from .services.sslcommerz import create_sslcomerz_session

# Create your views here.







class PaymentViewSet(viewsets.ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(profile__user=self.request.user)

    def create(self, request, *args, **kwargs):
        offer_id = request.data.get('offer_id')
        transaction_id = request.data.get('transaction_id')
        password = request.data.get('password')
        otp_code = request.data.get('otp_code')
        
        try:
            # ট্রানজেকশন শুরু - এর ভেতরে কিছু ভুল হলে সব আগের মতো হয়ে যাবে
            with transaction.atomic():
                offer = Offer.objects.select_for_update().get(id=offer_id) # ডেটা লক করে রাখা
                user = request.user
                profile = user.profile

                payment_status = "pending"
                res_message = "Payment submitted for manual verification"

                # 🔹 ১. ব্যালেন্স পেমেন্ট লজিক
                if transaction_id == "BALANCE_PURCHASE":
                    if not user.check_password(password):
                        return Response({"detail": "ভুল পাসওয়ার্ড!"}, status=400)

                    if not profile.otp_code or str(profile.otp_code) != str(otp_code):
                        return Response({"detail": "ভুল ওটিপি কোড!"}, status=400)
                    
                    # ৫ মিনিটের মেয়াদ চেক
                    time_limit = profile.otp_created_at + timedelta(minutes=5)
                    if now() > time_limit:
                        return Response({"detail": "ওটিপি মেয়াদ শেষ!"}, status=400)

                    # ব্যালেন্স চেক (Decimal conversion)
                    user_balance = Decimal(str(profile.acount_balance))
                    price = Decimal(str(offer.price))

                    if user_balance < price:
                        return Response({"detail": "পর্যাপ্ত ব্যালেন্স নেই।"}, status=400)

                    # টাকা কাটা
                    profile.acount_balance -= price
                    profile.otp_code = ""  
                    profile.save()
                    
                    payment_status = "paid" 
                    res_message = "পেমেন্ট সফল হয়েছে!"
                
                # 🔹 ২. ম্যানুয়াল পেমেন্ট চেক
                else:
                    if not transaction_id:
                        return Response({"error": "Transaction ID is required"}, status=400)

                # ৩. পেমেন্ট রেকর্ড তৈরি (এইখানে ভুল হলেও এখন আর ব্যালেন্স কাটবে না)
                payment = Payment.objects.create(
                    profile=profile,
                    offer=offer,
                    amount=offer.price,
                    transaction_id=transaction_id,
                    status=payment_status 
                )

                return Response({
                    "message": res_message,
                    "payment_id": payment.id,
                    "status": payment_status
                }, status=201)

        except Offer.DoesNotExist:
            return Response({"error": "Invalid offer"}, status=400)
        except Exception as e:
            # ট্রানজেকশন অটোমেটিক রোলব্যাক হয়ে যাবে
            print(f"ROLLBACK OCCURRED: {str(e)}")
            return Response({"error": f"পেমেন্ট সফল হয়নি: {str(e)}"}, status=500)
        
        
        
class ManualPaymentCreateView(APIView):
    def post(self, request):
       
        transaction_id = request.data.get('transaction_id')
        amount = request.data.get('amount')

        try:

            payment = Payment.objects.create(
                profile=request.user.profile,
                amount=amount,
                transaction_id=transaction_id,
                status='pending'
            )
            

            return Response({
                'message': 'Payment submitted fo verification',
                'payment_id': payment.id
            }, status=status.HTTP_201_CREATED)

       
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

