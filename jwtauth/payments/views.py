from django.shortcuts import render
from decimal import Decimal
import logging
logger = logging.getLogger(__name__)
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


class AutomaticPaymentVerifyView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_obj = request.FILES.get('screenshot')
        if not file_obj:
            return Response({'error': 'No screenshot file provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if not file_obj.name.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            return Response({'error': 'Invalid file format. Please upload an image (PNG, JPG, JPEG).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            image_bytes = file_obj.read()
            mime_type = file_obj.content_type or 'image/jpeg'

            from aiAgent.payment_verification import verify_payment_screenshot
            verification_result = verify_payment_screenshot(image_bytes, mime_type)

            status_val = verification_result.get('status')
            amount = verification_result.get('amount')
            transaction_id = verification_result.get('transaction_id')
            payment_method = verification_result.get('payment_method')
            reason = verification_result.get('reason')

            if status_val != 'success' or not amount or not transaction_id:
                error_msg = reason or "Could not extract clear transaction details. Please make sure the screenshot shows a completed transaction."
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

            try:
                amount_decimal = Decimal(str(amount))
            except Exception:
                return Response({'error': 'Invalid transaction amount detected.'}, status=status.HTTP_400_BAD_REQUEST)

            if Payment.objects.filter(transaction_id=transaction_id).exists():
                return Response({'error': f'Transaction ID {transaction_id} has already been verified/submitted.'}, status=status.HTTP_400_BAD_REQUEST)

            # Define automatic paid threshold dynamically from GlobalSettings
            from settings.models import GlobalSettings
            g_settings = GlobalSettings.get_settings()
            threshold = g_settings.payment_verify_threshold
            is_auto_paid = amount_decimal <= threshold
            payment_status = 'paid' if is_auto_paid else 'pending'

            # Save the screenshot file locally for audit log verification
            import os
            from django.core.files.storage import default_storage
            from django.core.files.base import ContentFile
            
            try:
                screenshot_dir = 'payment_screenshots'
                filename = f"{transaction_id}_{now().strftime('%Y%m%d%H%M%S')}.jpg"
                path = default_storage.save(os.path.join(screenshot_dir, filename), ContentFile(image_bytes))
                logger.info(f"Payment screenshot saved to storage at {path}")
            except Exception as se:
                logger.error(f"Failed to save payment screenshot file: {se}")

            # Create payment
            payment = Payment.objects.create(
                profile=request.user.profile,
                amount=amount_decimal,
                transaction_id=transaction_id,
                payment_type='balance',
                status=payment_status
            )

            if is_auto_paid:
                return Response({
                    'success': True,
                    'message': f'Success! {amount_decimal} BDT added to your account balance.',
                    'payment_id': payment.id,
                    'transaction_id': transaction_id,
                    'amount': amount_decimal,
                    'payment_method': payment_method,
                    'status': 'paid'
                }, status=status.HTTP_201_CREATED)
            else:
                return Response({
                    'success': True,
                    'message': f'Submitted! Since the amount is above 2000 BDT, it is kept pending for admin manual review.',
                    'payment_id': payment.id,
                    'transaction_id': transaction_id,
                    'amount': amount_decimal,
                    'payment_method': payment_method,
                    'status': 'pending'
                }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': f'Internal Server Error: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

