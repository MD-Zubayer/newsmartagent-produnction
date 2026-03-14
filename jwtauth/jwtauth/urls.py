from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.routers import DefaultRouter

# ভিউগুলোকে আলাদা নামে ইমপোর্ট করুন যাতে কনফ্লিক্ট না হয়
from users.views import (
    UserViewSet, LoginView, LogoutView, ForgotPasswordView, 
    ResetPasswordView, OfferViewSet, SubscriptionViewSet, 
    CookieTokenRefreshView, CookieTokenVerifyView, OrderSubmitView, NSABalanceTransferView, SendPaymentOTPView, SendTransferOTPView
)
from payments.views import PaymentViewSet
from webhooks import views as webhook_views
from aiAgent import views as ai_views
from datasheet import views as datasheet_views
from man_agent.views import ManAgentConfigViewSet
from man_agent.views import AgentDashboardStatsView
from users import oauth_views
from blog import views as blog_views


router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'offers', OfferViewSet, basename='offer')
router.register(r'subscriptions', SubscriptionViewSet, basename='subscription')
router.register(r'payments', PaymentViewSet, basename='payment')
router.register(r'orders', OrderSubmitView, basename='order')
router.register(r'man-agent-config', ManAgentConfigViewSet, basename='man-agent-config')
router.register(r'blog/posts', blog_views.BlogPostViewSet, basename='blog-posts')
router.register(r'blog/categories', blog_views.CategoryViewSet, basename='blog-categories')



urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('allauth.urls')),
    path('api/send-payment-otp/', SendPaymentOTPView.as_view(), name='send-payment-otp'),
    path('api/send-transfer-otp/', SendTransferOTPView.as_view(), name='send-transfer-otp'),
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
    path('api/transfer/', NSABalanceTransferView.as_view(), name='tarnsfer'),
    
    # Facebook Integration Endpoints
    path('api/facebook/login/', oauth_views.facebook_login, name='facebook_login'),
    path('api/facebook/callback/', oauth_views.facebook_callback, name='facebook_callback'),
    path('api/facebook/pages/', oauth_views.get_connected_pages, name='facebook_pages'),
    path('api/facebook/data-deletion/', oauth_views.facebook_data_deletion, name='facebook_data_deletion'),

    # CKEditor
    path('ckeditor/', include('ckeditor_uploader.urls')),

    
    # অ্যাপ ভিত্তিক ইউআরএল
    path('api/webhooks/', include('webhooks.urls')),
    path('api/AgentAI/', include('aiAgent.urls')),
    path('api/datasheet/', include("datasheet.urls")),
    path('api/embedding/', include("embedding.urls")),
    path('api/agent-state/', AgentDashboardStatsView.as_view(), name='agent-stats')
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Production এ যদি Nginx হ্যান্ডেল না করে, তবে Django দিয়ে ফোর্সলি সার্ভ করা (অস্থায়ী সলিউশন হিসেবে)
    from django.views.static import serve
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
        re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT}),
    ]
