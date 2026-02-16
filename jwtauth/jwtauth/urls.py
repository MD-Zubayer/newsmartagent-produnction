from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.routers import DefaultRouter

# ভিউগুলোকে আলাদা নামে ইমপোর্ট করুন যাতে কনফ্লিক্ট না হয়
from users.views import (
    UserViewSet, LoginView, LogoutView, ForgotPasswordView, 
    ResetPasswordView, OfferViewSet, SubscriptionViewSet, 
    CookieTokenRefreshView, CookieTokenVerifyView, OrderSubmitView
)
from payments.views import PaymentViewSet
from webhooks import views as webhook_views
from aiAgent import views as ai_views
from datasheet import views as datasheet_views
from man_agent.views import ManAgentConfigViewSet
from man_agent.views import AgentDashboardStatsView


router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'offers', OfferViewSet, basename='offer')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'orders', OrderSubmitView, basename='order')
router.register(r'man-agent-config', ManAgentConfigViewSet, basename='man-agent-config')



urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),

    path('api/', include(router.urls)),
    path('api/', include('chat.urls')),
    path('api/', include('payments.urls')),
    path('api/login/', LoginView.as_view(), name='login'),
    path("api/logout/", LogoutView.as_view(), name="logout"),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/verify/', CookieTokenVerifyView.as_view(), name='verify_token'),
    path('api/token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
    path('api/forgot-password/', ForgotPasswordView.as_view(), name='forgot_password'),
    path("api/reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    
    # অ্যাপ ভিত্তিক ইউআরএল
    path('webhooks/', include('webhooks.urls')),
    path('api/AgentAI/', include('aiAgent.urls')), # এই লাইনটি এখন কাজ করবে
    path('api/datasheet/', include("datasheet.urls")),
    path('api/agent-state/', AgentDashboardStatsView.as_view(), name='agent-stats')
]