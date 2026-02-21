from django.shortcuts import render, get_object_or_404
from decimal import Decimal
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import viewsets, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Profile, Payment, Subscription, Offer
from .serializers import UserSerializer, OfferSerializer, SubscriptionSerializer, NSATransferSerializer
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from datetime import datetime, timedelta, timezone
import jwt
from django.conf import settings
from users.services.email_service import send_reset_email, send_verification_email
from users.authentication import CookieJWTAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.views import TokenRefreshView
from users.serializers import CookieTokenRefreshSerializer
from rest_framework_simplejwt.serializers import TokenVerifySerializer
from django.utils.timezone import now
from datasheet.models import Spreadsheet
from users.models import CustomerOrder, OrderForm, EmailVerificationToken, NSATransfer
from users.serializers import CustomerOrderSerializer
from man_agent.utils import distribute_agent_commission
from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.db.models import Q
# Create your views here.
# Custom refresh token serializers, this set token to cookies after refresh

class CookieTokenRefreshView(TokenRefreshView):
    serializer_class = CookieTokenRefreshSerializer

    def finalize_response(self, request, response, *args, **kwargs):

        access = response.data.get('access')
        refresh = response.data.get('refresh')

        if access:
            response.set_cookie("access_token",
            access,
            httponly=True,
            secure=False,
            samesite="Lax",

            )

        if response.data.get('refresh'):
            response.set_cookie(
                'refresh_token',
                response.data['refresh'], 
                httponly=True,
                secure=False,
                samesite='Lax'
            )
            response.data = {}
            
        return super().finalize_response(request, response, *args, **kwargs)



# cuotm verify token view
class CookieTokenVerifyView(TokenRefreshView):
    serializer_class = TokenVerifySerializer

    def post(self, request, *args, **kwargs):

        # get token from cookie
        token = request.COOKIES.get('access_token')

        # get token from cookie, if not cookie take form body
        if not token:
            token = request.data.get('token')
        
        # if not token
        if not token:
            return Response({
                'detail': "Token is required in cookie ro bobe"
            }, status=status.HTTP_400_BAD_REQUEST)

        # serializer body data overwrite
        serializer = self.get_serializer(data={'token': token})
        try:
            serializer.is_valid(raise_exception=True)
            return Response({}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Token is invalid or expired"}, 
                status=status.HTTP_401_UNAUTHORIZED)


class UserViewSet(viewsets.ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    lookup_field = 'id'



    def get_permissions(self):
        if self.action in ['create_user', 'verify_email']:
            return [AllowAny()]
        elif self.action in ['me', 'get_form_id', 'update_me']:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    @action(detail=False, methods=['get'], url_path='me')
    def me(self, request):
        print(f"Authenticated User: {request.user}")
        user = request.user
        serializer = self.get_serializer(user)

        first_sheet = Spreadsheet.objects.filter(user=user).first()

        data = serializer.data
        data['sheet_id'] = first_sheet.id if first_sheet else None

        return Response(data)
    @action(detail=False, methods=['get'], url_path='get-form-id')
    def get_form_id(self, request):
        # OneToOneField থাকলে সরাসরি অ্যাক্সেস করা যায়
        # যদি order_form না থাকে তবে create হবে
        order_form, created = OrderForm.objects.get_or_create(user=request.user)
        return Response({'form_id': str(order_form.form_id)})   

    @action(detail=False, methods=['post'], url_path='create_user', permission_classes=[AllowAny] )
    def create_user(self, request):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save(is_verified=False)

            # create verify token
            token_obj = EmailVerificationToken.objects.create(user=user)
            
            verify_link = f'https://newsmartagent.com/verify-email?token={token_obj.token}'
            
            try: 
                send_verification_email(user.email, verify_link)
                print(f"Verification email sent to {user.email}")
            except Exception as e:
                print(f'Email error: {e}')
                return Response({
                    'message': "User created but email could not be sent. Please contact the Support Center."
                }, status=status.HTTP_201_CREATED)
            return Response({
                'message': "User created. Please check your email to verify your account."
            }, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['patch', 'put'], url_path='update-me', permission_classes=[IsAuthenticated])
    def update_me(self, request):
        user = request.user
        serializer = self.get_serializer(user, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    
    
    @action(detail=False, methods=['post'], url_path='verify-email')
    def verify_email(self, request):
        token = request.data.get('token')
        if not token:
            return Response({
                'error': "Token is required"}, status=400)

        token_obj = get_object_or_404(EmailVerificationToken, token=token)

        if token_obj.is_valid():
            user = token_obj.user
            user.is_verified = True
            user.save()
            token_obj.delete()

            refresh = RefreshToken.for_user(user)
            response = Response({
               "message": "Email verified and logged in successfully.",
                "user_id": user.id
            }, status=200)
            
            self._set_auth_cookies(response, refresh)
            return response
        return Response({"error": "Invalid or expired token"}, status=400)
    
    def _set_auth_cookies(self, response, refresh):

        access_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME', timedelta(minutes=60))
        refresh_lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))

        response.set_cookie(
                key='access_token',
                value=str(refresh.access_token),
                httponly=True,
                secure=settings.DEBUG is False,
                samesite='Lax',
                max_age=int(access_lifetime.total_seconds())
            )
        response.set_cookie(
            key="refresh_token", 
            value=str(refresh),
            httponly=True,
            samesite="Lax",
            secure=False,
            max_age=int(refresh_lifetime.total_seconds())

        )

        
class LoginView(APIView):
    """email + password login and JWT token generate
    """


    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_verified:
            return Response({"error": "Email is not verified. Please check your inbox."
            }, status=status.HTTP_403_FORBIDDEN)

        # JWT Token generation
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            "user": {
                "id": user.id,
                "email": user.email
            },
            "message": "Login successful"
            }, status=status.HTTP_200_OK
        )

        # Httponly cookie set
        response.set_cookie(key='access_token',
        value=access_token,
        httponly=True,
        samesite="Lax", # its in dev, production 'strict' , None
        secure=settings.DEBUG is False,#HTTPS True, dev False
        path='/',
        

        )
        response.set_cookie(
            key="refresh_token", 
            value=refresh_token,
            httponly=True,
            samesite="Lax",
            secure=settings.DEBUG is False,
            path='/',
        )

        return response
    


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request):

        try:
            refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            response = Response({"message": "Successfully logged out"}, status=status.HTTP_200_OK)

            # delete cookie from browser
            response.delete_cookie('access_token', path='/')
            response.delete_cookie('refresh_token', path='/')

            response.set_cookie('access_token', '', max_age=0, httponly=True, samesite='Lax', path='/')
            response.set_cookie('refresh_token', '', max_age=0, httponly=True, samesite='Lax', path='/')
            return response
         
        except Exception as e:
            response = Response({'error': "Logged out with session cleanup"}, status=status.HTTP_200_OK)
            response.delete_cookie('access_token', path='/')
            response.delete_cookie('refresh_token', path='/')
            return response



class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')

        if not email:
            return Response(
                {"error": 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:

            # security best practice

            return Response(
                {'message': 'If email exists, reset link sent'}, 
                status=status.HTTP_200_OK
            )

        #  JWT reset token
        payload = {
            'user_id': user.id, 
            'type': 'password_reset', 
            'exp': datetime.now() + timedelta(minutes=15),
        }

        token = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
        if isinstance(token, bytes):
            token = token.decode("utf-8")

        reset_link = f"https://newsmartagent.com/reset-password?token={token}"

        # send email
        send_reset_email(user.email, reset_link)

        return Response(
           { "message": 'if email exists, reset link sent'},
           status=status.HTTP_200_OK
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]


    def post(self, request):
        token = request.data.get('token')
        new_password = request.data.get('new_password')

        if not token or not new_password:
            return Response({"error": "Token and password are required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])

        except jwt.ExpiredSignatureError:
            return Response({"error": "Token expired"}, status=400)
        except jwt.InvalidTokenError:
            return Response({'error': 'Invalid token'}, status=400)
        
        try:
            user = User.objects.get(id=payload['user_id'])
        
        except User.DoesNotExist:
            return Response({'error': "User not found"}, status=404)

        user.set_password(new_password)
        user.save()

        return Response({'message': "password reset successfully"}, status=200)



class OfferViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    serializer_class = OfferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = Offer.objects.filter(is_active=True).prefetch_related('allowed_platforms')

        if user.created_by != 'agent':
            queryset = queryset.filter(target_audience='all')
        
        return queryset


class SubscriptionViewSet(viewsets.ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    serializer_class = SubscriptionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Subscription.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        payment_id = self.request.data.get('payment_id')
        try:
            
            with transaction.atomic():
            
                payment = Payment.objects.select_for_update().get(id=payment_id)
                if payment.status == 'paid':

                    serializer.save(profile=self.request.user.profile, payment=payment, is_active=True)
    

                else:
                    raise ValidationError('Payment is not completed yet.')
        except Payment.DoesNotExist:
            raise ValidationError('Invalid Payment id')
        
                
                
class OrderSubmitView(viewsets.ModelViewSet):
    queryset = CustomerOrder.objects.all()
    serializer_class = CustomerOrderSerializer
    
    def get_permissions(self):
        if self.action == 'create':
            return [permissions.AllowAny()]

        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        if self.request.user.is_authenticated:
            return CustomerOrder.objects.filter(user=self.request.user).order_by('-created_at')
        return CustomerOrder.objects.none()

    def perform_create(self, serializer):
        return serializer.save()
    
    def perform_update(self, serializer):
        serializer.save()





def get_order_form_link(user):
    
    try:
        order_form = OrderForm.objects.get(user=user)


        frontend_base_url = 'http://localhost:3000/orders'


       
        return f'{frontend_base_url}/{order_form.form_id}'
    except OrderForm.DoesNotExist:
        return None



class NSABalanceTransferView(APIView):

    def get(self, request):
        # ইউজার নিজে পাঠিয়েছে অথবা তাকে কেউ পাঠিয়েছে—এমন সব ট্রান্সফার
        transfers = NSATransfer.objects.filter(
            Q(sender=request.user) | Q(receiver=request.user)
        ).order_by('-created_at')
        
        serializer = NSATransferSerializer(transfers, many=True)
        return Response(serializer.data)



    def post(self, request):
        sender_user = request.user
        receiver_unique_id = request.data.get('receiver_unique_id')
        amount_str = request.data.get('amount')

        # 1. Input validation
        try:
            amount = Decimal(str(amount_str))
            if amount <= 0:
                return Response({'error': 'Amount must be greater than 0.' }, status=status.HTTP_400_BAD_REQUEST)
        
        except (ValueError, TypeError):
            return Response({"error": "Enter the correct amount."}, status=status.HTTP_400_BAD_REQUEST)     

        # 2. Start transaction block (so that money is not lost)
        try:
            with transaction.atomic():
                # Locking sender profile (to avoid race condition)
                sender_profile = Profile.objects.select_for_update().get(user=sender_user)

                if sender_profile.acount_balance < amount:
                    return Response({'error': "Not enough balance."},status=status.HTTP_400_BAD_REQUEST )
                
                # Finding the receiver (by Unique ID)
                try:
                    receiver_profile = Profile.objects.select_for_update().get(unique_id=receiver_unique_id)
                
                except Profile.DoesNotExist:
                    return Response({"error": "Receiver's Unique ID not found."}, status=status.HTTP_404_NOT_FOUND)
                
                if sender_profile == receiver_profile:
                    return Response({"error": "It is not possible to transfer yourself."}, status=status.HTTP_400_BAD_REQUEST)

                sender_profile.acount_balance -= amount
                sender_profile.save()

                receiver_profile.acount_balance += amount
                receiver_profile.save()

                NSATransfer.objects.create(
                    sender=sender_user,
                    receiver=receiver_profile.user,
                    amount=amount
                )
                sender_display = getattr(sender_user, 'name', None) or sender_user.email
                receiver_display = getattr(receiver_profile.user, 'name', None) or receiver_profile.user.email
                
                
                from chat.models import Notification
                Notification.objects.create(
                    user=receiver_profile.user,
                    message=f"You received {amount} BDT from {sender_display}.",
                    type='transfer_success'
                    
                )

                Notification.objects.create(
                    user=sender_user,
                    message=f'Success! {amount} BDT transferred to {receiver_display}.',
                    type='transfer_success'
                )
                
                return Response({
                   "message": "The transfer was successful.",
                    "new_balance": sender_profile.acount_balance
                }, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({"error": "There was a problem with the server. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)