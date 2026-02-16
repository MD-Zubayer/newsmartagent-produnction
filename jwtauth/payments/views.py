from django.shortcuts import render
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

        if not transaction_id:
            return Response({"error": "Transaction ID is required for manual payment"}, status=400)

        try:
            offer = Offer.objects.get(id=offer_id)
            profile = request.user.profile

            payment = Payment(
                profile=profile,
                offer=offer,
                amount=offer.price,
                transaction_id=transaction_id,
                status="pending"
            )

            payment.save()
            print(f"DEBUG: New Payment ID created: {payment.id}")
           

            return Response({
                "message": "Payment submitted for manual verification",
                "payment_id": payment.id,
                "amount": offer.price,
                "status": "pending"
            }, status=201)

        except Offer.DoesNotExist:
            return Response({"error": "Invalid offer"}, status=400)

        except Exception as e:
            print(f"ERROR during save: {str(e)}")
            return Response({"error": str(e)}, status=400)



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

