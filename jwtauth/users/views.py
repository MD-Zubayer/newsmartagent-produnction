from django.shortcuts import render, get_object_or_404
from decimal import Decimal
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework import viewsets, permissions
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, Profile, Payment, Subscription, Offer
from .serializers import UserSerializer, OfferSerializer, SubscriptionSerializer, NSATransferSerializer, WithdrawMethodSerializer, CashoutRequestSerializer
from rest_framework import status
from django.contrib.auth import authenticate
from rest_framework.views import APIView
from datetime import datetime, timedelta, timezone
import jwt
from django.conf import settings
from users.services.email_service import send_reset_email, send_verification_email, send_2fa_otp_email
from users.authentication import CookieJWTAuthentication
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.views import TokenRefreshView
from users.serializers import CookieTokenRefreshSerializer
from rest_framework_simplejwt.serializers import TokenVerifySerializer
from django.utils import timezone
from django.utils.timezone import now
from datasheet.models import Spreadsheet
from users.models import CustomerOrder, OrderForm, EmailVerificationToken, NSATransfer, WithdrawMethod, CashoutRequest, LoginSession, LoginHistory, TrustedDevice, RecoveryCode
from users.serializers import CustomerOrderSerializer
from man_agent.utils import distribute_agent_commission
from django.db import transaction
from rest_framework.exceptions import ValidationError
from django.db.models import Q
from users.services.email_service import (
    send_reset_email, send_verification_email, send_2fa_otp_email,
    send_security_alert_email, send_push_approval_email, send_whatsapp_alert
)
import random
from django.core.mail import send_mail


from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


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
        payload = request.data.copy()
        
        # Handle profile photo upload or deletion
        if 'profile_photo' in request.data or 'profile_photo' in request.FILES:
            profile = user.profile
            new_photo = request.FILES.get('profile_photo')
            if new_photo is None:
                raw_data = request.data.get('profile_photo')
                if raw_data in ('null', '', None):
                    new_photo = None
                else:
                    new_photo = raw_data

            old_photo = profile.profile_photo
            if old_photo and (new_photo is None or old_photo != new_photo):
                try:
                    old_photo.delete(save=False)
                except Exception as e:
                    print(f"File deletion error: {e}")

            if new_photo is None:
                profile.profile_photo = None
            else:
                profile.profile_photo = new_photo
            profile.save(update_fields=["profile_photo"])
            payload.pop('profile_photo', None)

        serializer = self.get_serializer(user, data=payload, partial=True)
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
    """Email + password login with Trust Device, Push Approval, and JWT generation"""
    permission_classes = [AllowAny]

    def _get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')

    def _get_device_name(self, request):
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        # Simple extraction instead of installing packages
        if 'Mobi' in user_agent:
            return f"Mobile Browser ({user_agent[:30]}...)"
        elif 'Windows' in user_agent:
            return "Windows PC"
        elif 'Mac' in user_agent:
            return "Mac System"
        elif 'Linux' in user_agent:
            return "Linux PC"
        return "Unknown Device"

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        auth_method = request.data.get("auth_method", "email_otp") # Options: email_otp, mobile_approval

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_verified:
            return Response({"error": "Email is not verified. Please check your inbox."}, status=status.HTTP_403_FORBIDDEN)

        ip_address = self._get_client_ip(request)
        device_name = self._get_device_name(request)
        profile = user.profile

        # 1. Trust Device Bypass check
        trust_cookie = request.COOKIES.get('trusted_device')
        is_trusted = False
        if trust_cookie:
            trusted_obj = TrustedDevice.objects.filter(user=user, device_token=trust_cookie).first()
            if trusted_obj and trusted_obj.is_valid():
                is_trusted = True

        # 2. Security Alert: Check if this is a new device or IP (very basic check based on last 5 logins)
        recent_logins = LoginHistory.objects.filter(user=user).order_by('-created_at')[:5]
        is_new_device = True
        for login in recent_logins:
            if login.ip_address == ip_address or login.device_name == device_name:
                is_new_device = False
                break
        
        # Check for trust_device from request data as well
        req_trust_device = request.data.get("trust_device", False)
        if str(req_trust_device).lower() == 'true':
            # This is only for the initial check, actual trust logic is in 2FA verify
            pass

        # If no history AND no trust, consider it new device (or if it strictly doesn't match recent)
        if is_new_device and not is_trusted:
            time_str = timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")
            # Send Security Alert to all channels
            send_security_alert_email(user.email, device_name, ip_address, time_str)
            if profile.recovery_email:
                send_security_alert_email(profile.recovery_email, device_name, ip_address, time_str)
            if profile.recovery_whatsapp:
                wa_msg = f"⚠️ *New Login Alert*\nDevice: {device_name}\nIP: {ip_address}\nTime: {time_str}\nIf this wasn't you, reset your password!"
                # send_whatsapp_alert(profile.recovery_whatsapp, wa_msg)

        # Log History
        LoginHistory.objects.create(user=user, ip_address=ip_address, device_name=device_name)

        # 3. Handle 2FA (if enabled and NOT trusted device)
        if profile.two_factor_enabled and not is_trusted:
            if auth_method == 'mobile_approval':
                trust_device = request.data.get("trust_device", False)
                if str(trust_device).lower() == 'true':
                    trust_device = True
                else:
                    trust_device = False

                session = LoginSession.objects.create(
                    user=user, 
                    ip_address=ip_address, 
                    device_name=device_name,
                    trust_device=trust_device,
                    expires_at=timezone.now() + timedelta(minutes=5)
                )
                
                frontend_url = getattr(settings, "FRONTEND_URL", "https://newsmartagent.com")
                approve_link = f"{frontend_url}/auth/approval?token={session.session_token}&action=approve"
                reject_link = f"{frontend_url}/auth/approval?token={session.session_token}&action=reject"
                
                # Send Push Approval Links to all channels
                send_push_approval_email(user.email, approve_link, reject_link, device_name)
                if profile.recovery_email:
                    send_push_approval_email(profile.recovery_email, approve_link, reject_link, device_name)
                if profile.recovery_whatsapp:
                    wa_msg = f"🔑 *Login Approval Request*\nDevice: {device_name}\nIP: {ip_address}\n\n✅ YES: {approve_link}\n\n❌ NO: {reject_link}"
                    # send_whatsapp_alert(profile.recovery_whatsapp, wa_msg)

                return Response({
                    "two_factor_required": True,
                    "auth_method": "mobile_approval",
                    "session_token": session.session_token,
                    "message": "Push notification sent. Please check your email and WhatsApp to approve."
                }, status=status.HTTP_200_OK)
            
            else:
                # Default: Email OTP
                otp = str(random.randint(100000, 999999))
                profile.otp_code = otp
                profile.otp_created_at = timezone.now()
                profile.save(update_fields=["otp_code", "otp_created_at"])

                try:
                    send_2fa_otp_email(user.email, otp)
                    if profile.recovery_email:
                        send_2fa_otp_email(profile.recovery_email, otp)
                    if profile.recovery_whatsapp:
                        # send_whatsapp_alert(profile.recovery_whatsapp, f"🔐 Your NSA Login OTP is: *{otp}*. Expires in 5 mins.")
                        pass
                except Exception as e:
                    print(f"2FA email/wa send failed: {e}")

                return Response({
                    "two_factor_required": True,
                    "auth_method": "email_otp",
                    "available_methods": ["email_otp", "mobile_approval", "recovery_code"],
                    "message": "A 6-digit code has been sent to your primary/recovery channels."
                }, status=status.HTTP_200_OK)

        # 4. Generate JWT Base Login
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            "user": {"id": user.id, "email": user.email},
            "message": "Login successful"
        }, status=status.HTTP_200_OK)

        response.set_cookie(key='access_token', value=access_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
        response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')

        # ALWAYS create a session record so the device can be remotely revoked
        import uuid as _uuid
        _device_token = str(_uuid.uuid4())
        TrustedDevice.objects.create(
            user=user,
            device_token=_device_token,
            device_name=device_name or "Unknown Device",
            is_trusted=False,
            expires_at=timezone.now() + timedelta(days=30)
        )
        response.set_cookie(key='trusted_device', value=_device_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/', max_age=30*24*60*60)
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

        queryset = Offer.objects.filter(is_active=True).prefetch_related('allowed_platforms', 'allowed_models')

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

    @action(detail=False, methods=['get'], url_path='public-profile/(?P<form_id>[^/.]+)', permission_classes=[AllowAny])
    def public_profile(self, request, form_id=None):
        try:
            order_form = OrderForm.objects.get(form_id=form_id)
            user = order_form.user
            profile_photo_url = None
            if hasattr(user, 'profile') and user.profile.profile_photo:
                profile_photo_url = request.build_absolute_uri(user.profile.profile_photo.url)

            return Response({
                'name': user.name or user.email,
                'profile_photo_url': profile_photo_url
            })
        except OrderForm.DoesNotExist:
            return Response({'error': 'Form not found'}, status=404)

    @action(detail=False, methods=['get'], url_path='track', permission_classes=[AllowAny])
    def track_by_phone(self, request):
        phone = request.query_params.get('phone', '').strip()
        if not phone:
            return Response({'error': 'Phone number is required'}, status=400)
        orders = CustomerOrder.objects.filter(phone_number__icontains=phone).order_by('-created_at')
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)





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

        # 2. OTP and Password Verification
        password = request.data.get('password')
        otp_code = request.data.get('otp_code')

        if not password or not otp_code:
            return Response({'error': 'Password and OTP code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not sender_user.check_password(password):
            return Response({'error': 'Incorrect password.'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Start transaction block
        try:
            with transaction.atomic():
                # Locking sender profile
                sender_profile = Profile.objects.select_for_update().get(user=sender_user)

                # Verify OTP
                if not sender_profile.otp_code or str(sender_profile.otp_code) != str(otp_code):
                    return Response({'error': 'Incorrect OTP code.'}, status=status.HTTP_400_BAD_REQUEST)
                
                # Check OTP expiry
                time_limit = sender_profile.otp_created_at + timedelta(minutes=5)
                if now() > time_limit:
                    return Response({'error': 'OTP has expired.'}, status=status.HTTP_400_BAD_REQUEST)

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
                sender_profile.otp_code = "" # Clear OTP after use
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
        
        
        
        
class SendPaymentOTPView(APIView):
    authentication_classes = [CookieJWTAuthentication] 
    permission_classes = [IsAuthenticated]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
    def post(self, request):
        user = request.user
        
        otp = str(random.randint(100000, 999999)) 
        
        # ২. প্রোফাইলে OTP সেভ করুন (যাতে পরে ভেরিফাই করা যায়)
        profile = user.profile
        profile.otp_code = otp
        profile.otp_created_at = timezone.now()
        profile.save()
    
        subject = "Payment Verification Code - New Smart Agent"
        message = f"Hello {getattr(user, 'name', '') or getattr(user, 'email', '')},\n\nYour OTP for payment verification is: {otp}.\n\nThis verify code will expire in 5 minutes.\n\nThank you,\nNew Smart Agent Team"
        
        html_message = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f3f4f6;
                    margin: 0;
                    padding: 0;
                    color: #1f2937;
                }}
                .email-container {{
                    max-width: 600px;
                    margin: 40px auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                }}
                .header {{
                    background: linear-gradient(135deg, #111827 0%, #374151 100%);
                    padding: 24px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    color: #ffffff;
                    margin: 0;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }}
                .content {{
                    padding: 40px 32px;
                    text-align: center;
                }}
                .content h2 {{
                    color: #111827;
                    margin-top: 0;
                    font-size: 22px;
                    margin-bottom: 16px;
                }}
                .content p {{
                    font-size: 16px;
                    line-height: 1.6;
                    color: #4b5563;
                    margin-bottom: 24px;
                }}
                .otp-box {{
                    display: inline-block;
                    background-color: #f8fafc;
                    border: 2px dashed #cbd5e1;
                    border-radius: 12px;
                    padding: 24px 48px;
                    margin-bottom: 24px;
                }}
                .otp-code {{
                    font-size: 36px;
                    font-weight: 800;
                    color: #0f172a;
                    letter-spacing: 8px;
                    margin: 0;
                    line-height: 1;
                }}
                .security-notice {{
                    background-color: #fef2f2;
                    border-left: 4px solid #ef4444;
                    padding: 16px;
                    text-align: left;
                    border-radius: 0 8px 8px 0;
                    margin-top: 8px;
                }}
                .security-notice p {{
                    margin: 0;
                    color: #991b1b;
                    font-size: 14px;
                    font-weight: 500;
                }}
                .footer {{
                    background-color: #f9fafb;
                    padding: 24px;
                    text-align: center;
                    border-top: 1px solid #e5e7eb;
                }}
                .footer p {{
                    font-size: 13px;
                    color: #6b7280;
                    margin: 4px 0;
                    }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <img src="https://newsmartagent.com/newsmartagent.png" width="80" style="margin-bottom: 10px; border-radius: 8px;"><br>
                    <h1>New Smart Agent</h1>
                </div>
                <div class="content">
                    <h2>Payment Security Verification</h2>
                    <p>Hello <strong>{getattr(user, 'name', '') or getattr(user, 'email', '')}</strong>,</p>
                    <p>We received a request to verify your payment. Please use the following One-Time Password (OTP) to complete your transaction:</p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    
                    <div class="security-notice">
                        <p>⚠️ <strong>Security Important:</strong> This code is valid for <strong>5 minutes</strong>. Never share this code with anyone. Our staff will never ask for this code.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>If you didn't request this verification, please secure your account immediately or contact support.</p>
                    <p>&copy; {now().year} New Smart Agent. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        from_email = settings.EMAIL_HOST_USER
        
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[user.email],
                html_message=html_message
            )
            return Response({"message": "OTP sent successfully to your email."})
        except Exception as e:
            return Response({"error": "Failed to send email."}, status=500)


class SendTransferOTPView(APIView):
    authentication_classes = [CookieJWTAuthentication] 
    permission_classes = [IsAuthenticated]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)
        
    def post(self, request):
        user = request.user
        profile = user.profile

        otp = str(random.randint(100000, 999999))

        profile.otp_code = otp
        profile.otp_created_at = now()
        profile.save()

        subject = "Transfer Verification Code - New Smart Agent"
        message = f"Hello {getattr(user, 'name', '') or getattr(user, 'email', '')},\n\nYour OTP for balance transfer verification is: {otp}.\n\nThis verify code will expire in 5 minutes.\n\nThank you,\nNew Smart Agent Team"
        
        html_message = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background-color: #f3f4f6;
                    margin: 0;
                    padding: 0;
                    color: #1f2937;
                }}
                .email-container {{
                    max-width: 600px;
                    margin: 40px auto;
                    background-color: #ffffff;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                    overflow: hidden;
                    border: 1px solid #e5e7eb;
                }}
                .header {{
                    background: linear-gradient(135deg, #111827 0%, #6366f1 100%);
                    padding: 24px 20px;
                    text-align: center;
                }}
                .header h1 {{
                    color: #ffffff;
                    margin: 0;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                }}
                .content {{
                    padding: 40px 32px;
                    text-align: center;
                }}
                .content h2 {{
                    color: #111827;
                    font-size: 22px;
                    margin-bottom: 16px;
                }}
                .content p {{
                    font-size: 16px;
                    line-height: 1.6;
                    color: #4b5563;
                    margin-bottom: 24px;
                }}
                .otp-box {{
                    display: inline-block;
                    background-color: #f5f3ff;
                    border: 2px dashed #8b5cf6;
                    border-radius: 12px;
                    padding: 24px 48px;
                    margin-bottom: 24px;
                }}
                .otp-code {{
                    font-size: 36px;
                    font-weight: 800;
                    color: #5b21b6;
                    letter-spacing: 8px;
                    margin: 0;
                }}
                .security-notice {{
                    background-color: #fff7ed;
                    border-left: 4px solid #f97316;
                    padding: 16px;
                    text-align: left;
                    border-radius: 0 8px 8px 0;
                }}
                .security-notice p {{
                    margin: 0;
                    color: #9a3412;
                    font-size: 14px;
                    font-weight: 500;
                }}
                .footer {{
                    background-color: #f9fafb;
                    padding: 24px;
                    text-align: center;
                    border-top: 1px solid #e5e7eb;
                }}
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <img src="https://newsmartagent.com/newsmartagent.png" width="80" style="margin-bottom: 10px; border-radius: 8px;"><br>
                    <h1>New Smart Agent</h1>
                </div>
                <div class="content">
                    <h2>Balance Transfer Verification</h2>
                    <p>Hello <strong>{getattr(user, 'name', '') or getattr(user, 'email', '')}</strong>,</p>
                    <p>You are initiating a balance transfer. Please use the following OTP to confirm this transaction:</p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{otp}</div>
                    </div>
                    
                    <div class="security-notice">
                        <p>⚠️ <strong>Important:</strong> This code is valid for 5 minutes. If you did not initiate this transfer, please change your password immediately.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>&copy; {now().year} New Smart Agent. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        from_email = settings.EMAIL_HOST_USER
        
        try:
            send_mail(
                subject=subject,
                message=message,
                from_email=from_email,
                recipient_list=[user.email],
                html_message=html_message
            )
            return Response({"message": "Transfer OTP sent successfully to your email."})
        except Exception as e:
            return Response({"error": "Failed to send email."}, status=500)


class WithdrawMethodViewSet(viewsets.ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = WithdrawMethodSerializer

    def get_queryset(self):
        return WithdrawMethod.objects.filter(profile=self.request.user.profile).order_by('-is_default', '-created_at')


class CashoutRequestViewSet(viewsets.ModelViewSet):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = CashoutRequestSerializer

    def get_queryset(self):
        return CashoutRequest.objects.filter(profile=self.request.user.profile).order_by('-requested_at')


class FinancialSummaryView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        
        from django.db.models import Sum
        
        # Commission Balance Stats
        comm_pending = CashoutRequest.objects.filter(profile=profile, balance_type='commission', status='pending')
        comm_pending_amount = comm_pending.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        comm_success = CashoutRequest.objects.filter(profile=profile, balance_type='commission', status='approved')
        comm_success_amount = comm_success.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        comm_failed = CashoutRequest.objects.filter(profile=profile, balance_type='commission', status='rejected')
        comm_failed_amount = comm_failed.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        # Account Balance Stats
        acc_pending = CashoutRequest.objects.filter(profile=profile, balance_type='account', status='pending')
        acc_pending_amount = acc_pending.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        acc_success = CashoutRequest.objects.filter(profile=profile, balance_type='account', status='approved')
        acc_success_amount = acc_success.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        acc_failed = CashoutRequest.objects.filter(profile=profile, balance_type='account', status='rejected')
        acc_failed_amount = acc_failed.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        
        return Response({
            'commission_balance': profile.commission_balance,
            'commission_success': comm_success_amount,
            'commission_pending': comm_pending_amount,
            'commission_failed': comm_failed_amount,
            'account_balance': profile.acount_balance,
            'account_success': acc_success_amount,
            'account_pending': acc_pending_amount,
            'account_failed': acc_failed_amount,
        })


class Verify2FALoginView(APIView):
    """Multi-Level 2FA Verification (OTP or Recovery Code) + Trust Device Setting"""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        auth_method = request.data.get("auth_method", "email_otp") # email_otp or recovery_code
        code = request.data.get("code") or request.data.get("otp_code")
        trust_device = request.data.get("trust_device", False)

        if not email or not password or not code:
            return Response({"error": "email, password, and code are required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response({"error": "Invalid email or password"}, status=status.HTTP_401_UNAUTHORIZED)

        profile = user.profile
        if not getattr(profile, "two_factor_enabled", False):
            return Response({"error": "2FA is not enabled"}, status=status.HTTP_400_BAD_REQUEST)

        if auth_method == 'recovery_code':
            recovery_obj = RecoveryCode.objects.filter(user=user, code=code, is_used=False).first()
            if not recovery_obj:
                return Response({'error': 'Invalid or already used Recovery Code'}, status=status.HTTP_400_BAD_REQUEST)
            recovery_obj.is_used = True
            recovery_obj.save(update_fields=["is_used"])
        else:
            if not profile.otp_code or str(profile.otp_code) != str(code):
                return Response({'error': 'Incorrect OTP'}, status=status.HTTP_400_BAD_REQUEST)
            if not profile.otp_created_at or timezone.now() > profile.otp_created_at + timedelta(minutes=5):
                return Response({'error': 'OTP Expired'}, status=status.HTTP_400_BAD_REQUEST)
            profile.otp_code = ""
            profile.save(update_fields=["otp_code"])

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response({
            "user": {"id": user.id, "email": user.email},
            "message": "Login successful"
        }, status=status.HTTP_200_OK)

        response.set_cookie(key='access_token', value=access_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
        response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
        
        # ALWAYS create a session record (is_trusted=True only if user checked the box)
        import uuid as _uuid
        _device_token = str(_uuid.uuid4())
        _device_name = request.META.get('HTTP_USER_AGENT', 'Unknown Device')[:250]
        TrustedDevice.objects.create(
            user=user,
            device_token=_device_token,
            device_name=_device_name,
            is_trusted=str(trust_device).lower() == 'true',
            expires_at=timezone.now() + timedelta(days=30)
        )
        response.set_cookie(key='trusted_device', value=_device_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/', max_age=30*24*60*60)

        return response


class Toggle2FAView(APIView):
    """ইমেইল OTP 2FA অন/অফ করুন।"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        enabled = request.data.get("enabled")
        if enabled is None:
            return Response({"error": "enabled true/false পাঠান"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        try:
            profile = user.profile
            profile.two_factor_enabled = bool(enabled)
            profile.save(update_fields=["two_factor_enabled"])
        except Exception as e:
            import logging
            logging.getLogger(__name__).exception("Toggle2FA save failed for user %s: %s", getattr(user, "id", None), e)
            return Response({"error": "Could not update 2FA. Contact support."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        msg = "2FA চালু করা হয়েছে।" if profile.two_factor_enabled else "2FA বন্ধ করা হয়েছে।"

        return Response({
            "message": msg,
            "two_factor_enabled": profile.two_factor_enabled
        }, status=status.HTTP_200_OK)


class LoginSessionStatusView(APIView):
    """Browser polls this to check if push approval is granted via mobile"""
    permission_classes = [AllowAny]

    def get(self, request):
        session_token = request.query_params.get("session_token")
        if not session_token:
            return Response({"error": "Session token required"}, status=400)
            
        session = LoginSession.objects.filter(session_token=session_token).first()
        if not session:
            return Response({"error": "Invalid session"}, status=404)
        
        if session.status == 'approved':
            # Generate JWT
            refresh = RefreshToken.for_user(session.user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            response = Response({
                "user": {"id": session.user.id, "email": session.user.email},
                "message": "Login successful via Push Approval",
                "status": "approved"
            }, status=status.HTTP_200_OK)
            response.set_cookie(key='access_token', value=access_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
            response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
            
            # Session/Trust Device Setup (Always create for remote logout)
            import uuid
            device_token = str(uuid.uuid4())
            TrustedDevice.objects.create(
                user=session.user,
                device_token=device_token,
                device_name=session.device_name or "Unknown Device",
                is_trusted=getattr(session, 'trust_device', False),
                expires_at=timezone.now() + timedelta(days=30)
            )
            response.set_cookie(key='trusted_device', value=device_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/', max_age=30*24*60*60)
            
            return response
            
        elif session.status == 'rejected':
            return Response({"status": "rejected", "error": "Login request was rejected"}, status=403)
        
        elif timezone.now() > session.expires_at:
            session.status = 'expired'
            session.save()
            return Response({"status": "expired", "error": "Login request expired"}, status=408)
            
        return Response({"status": "pending"})

    def post(self, request):
        session_token = request.data.get("session_token")
        trust_device = request.data.get("trust_device", False)
        
        if not session_token:
            return Response({"error": "Session token required"}, status=400)
            
        session = LoginSession.objects.filter(session_token=session_token).first()
        if not session:
            return Response({"error": "Invalid session"}, status=404)
        
        if str(trust_device).lower() == 'true':
            session.trust_device = True
        else:
            session.trust_device = False
            
        session.save(update_fields=['trust_device'])
        return Response({"message": "Trust preference updated"})


class ApproveLoginSessionView(APIView):
    """Mobile user clicks Yes/No from email or WhatsApp which hits this endpoint"""
    permission_classes = [AllowAny]

    def get(self, request):
        session_token = request.query_params.get("token")
        action = request.query_params.get("action") # approve or reject
        
        if not session_token or action not in ['approve', 'reject']:
            return Response({"error": "Invalid request"}, status=400)
            
        session = LoginSession.objects.filter(session_token=session_token).first()
        if not session:
            return Response({"error": "Link invalid or already used"}, status=400)
            
        if timezone.now() > session.expires_at or session.status != 'pending':
            return Response({"error": "This request has expired or already been handled."}, status=400)
            
        if action == 'approve':
            session.status = 'approved'
            session.save(update_fields=['status'])
            
            # For Mobile Users: Generate JWT and set cookies so they are logged in immediately on this device
            refresh = RefreshToken.for_user(session.user)
            access_token = str(refresh.access_token)
            refresh_token = str(refresh)
            
            response = Response({
                "message": "Successfully Approved! Redirecting you to the dashboard...",
                "status": "approved"
            }, status=status.HTTP_200_OK)
            
            # Standard Cookie Setup (Matches LoginSessionStatusView)
            response.set_cookie(key='access_token', value=access_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
            response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/')
            
            # Session/Trust Device Setup (Always create for remote logout)
            import uuid
            device_token = str(uuid.uuid4())
            TrustedDevice.objects.create(
                user=session.user,
                device_token=device_token,
                device_name=session.device_name or "Mobile Approval Device",
                is_trusted=getattr(session, 'trust_device', False),
                expires_at=timezone.now() + timedelta(days=30)
            )
            response.set_cookie(key='trusted_device', value=device_token, httponly=True, samesite="Lax", secure=settings.DEBUG is False, path='/', max_age=30*24*60*60)
            
            return response
        else:
            session.status = 'rejected'
            session.save(update_fields=['status'])
            return Response({"message": "Request Blocked. We recommend resetting your password.", "status": "rejected"})

class SecuritySettingsView(APIView):
    """Fetch or generate recovery codes and update WhatsApp/Email Recovery fields"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        codes = RecoveryCode.objects.filter(user=request.user, is_used=False).values_list('code', flat=True)
        
        # Fetch trusted devices
        from users.models import TrustedDevice
        devices = TrustedDevice.objects.filter(user=request.user).order_by('-created_at')
        device_list = [{
            "id": d.id,
            "device_name": d.device_name or "Unknown Device",
            "is_trusted": d.is_trusted,
            "created_at": d.created_at,
            "is_expired": not d.is_valid()
        } for d in devices]

        return Response({
            "recovery_email": profile.recovery_email,
            "recovery_whatsapp": profile.recovery_whatsapp,
            "recovery_codes_count": codes.count(),
            "recovery_codes_available": list(codes) if codes.count() > 0 else [],
            "trusted_devices": device_list
        })

    def post(self, request):
        action = request.data.get("action")
        profile = request.user.profile

        if action == "generate_codes":
            import random, string
            RecoveryCode.objects.filter(user=request.user).delete()
            new_codes = []
            for _ in range(10):
                code = ''.join(random.choices(string.digits, k=8))
                RecoveryCode.objects.create(user=request.user, code=code)
                new_codes.append(code)
            return Response({"message": "Codes generated", "codes": new_codes})
        
        elif action == "update_recovery":
            email = request.data.get("recovery_email")
            wa = request.data.get("recovery_whatsapp")
            profile.recovery_email = email
            profile.recovery_whatsapp = wa
            profile.save(update_fields=["recovery_email", "recovery_whatsapp"])
            return Response({"message": "Recovery options updated successfully"})
            
        elif action == "remove_device":
            device_id = request.data.get("device_id")
            from users.models import TrustedDevice
            try:
                device = TrustedDevice.objects.get(id=device_id, user=request.user)
                device.delete()
                return Response({"message": "Device disconnected successfully"})
            except TrustedDevice.DoesNotExist:
                return Response({"error": "Device not found"}, status=404)

        return Response({"error": "Invalid action"}, status=400)

class LoginHistoryView(APIView):
    """View recent login history for Security Dashboard"""
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = LoginHistory.objects.filter(user=request.user).order_by('-created_at')[:20]
        data = [{
            "id": h.id,
            "ip_address": h.ip_address,
            "device_name": h.device_name,
            "created_at": h.created_at
        } for h in history]
        return Response(data)
