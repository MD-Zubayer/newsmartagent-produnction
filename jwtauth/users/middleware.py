from django.contrib.auth import get_user_model
from rest_framework_simplejwt.authentication import JWTAuthentication

User = get_user_model()

class TokenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # কুকি থেকে টোকেন নিয়ে হেডারে ইনজেক্ট করা
        access_token = request.COOKIES.get('access_token')
        if access_token and 'HTTP_AUTHORIZATION' not in request.META:
            request.META['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'

        response = self.get_response(request)

        # আইডি ডিলিট বাগ ফিক্স: ডাটাবেসে ইউজার আছে কি না চেক করা
        if access_token:
            try:
                auth = JWTAuthentication()
                validated_token = auth.get_validated_token(access_token)
                user = auth.get_user(validated_token)
                
                if not user or not user.is_active:
                    raise Exception("User not found or inactive")
            except:
                # ইউজার না থাকলে কুকি ডিলিট করে লগআউট করানো
                response.delete_cookie('access_token')
                response.delete_cookie('refresh_token')
        
        return response