from django.urls import path
from . import views
from . import message_views

app_name = 'storefront'

urlpatterns = [
    # Customer Auth
    path('auth/google/', views.GoogleAuthView.as_view(), name='google_auth'),
    path('auth/instant/', views.InstantSessionAuthView.as_view(), name='instant_auth'),
    path('auth/me/', views.CustomerMeView.as_view(), name='customer_me'),
    path('auth/logout/', views.CustomerLogoutView.as_view(), name='customer_logout'),
    path('shop-history/', views.CustomerShopHistoryView.as_view(), name='shop_history'),
    path('merchant-avatar/<int:merchant_id>/', views.MerchantAvatarView.as_view(), name='merchant_avatar'),

    # Session & Checkout
    path('session/resolve/<str:code>/', views.CheckoutSessionResolveView.as_view(), name='session_resolve'),
    path('checkout/submit/', views.CheckoutSubmitView.as_view(), name='checkout_submit'),
    path('shop/products/', views.SellerStorefrontProductsView.as_view(), name='seller_shop_products'),
    path('shop/session/', views.SellerStorefrontSessionView.as_view(), name='seller_shop_session'),

    # Orders & Tracking
    path('orders/', views.CustomerOrdersListView.as_view(), name='orders_list'),
    path('orders/<str:identifier>/', views.CustomerOrderDetailView.as_view(), name='order_detail'),
    path('orders/<str:identifier>/voice-action/', views.CustomerOrderVoiceActionView.as_view(), name='order_voice_action'),
    path('orders/<str:identifier>/cancel/', views.CustomerOrderCancelView.as_view(), name='order_cancel'),
    path('orders/<str:identifier>/edit-address/', views.CustomerOrderEditAddressView.as_view(), name='order_edit_address'),

    # Addresses
    path('addresses/', views.CustomerAddressesView.as_view(), name='addresses'),
    path('addresses/<int:pk>/', views.CustomerAddressDetailView.as_view(), name='address_detail'),

    # Smart Checkout Utilities
    path('courier/providers/', views.CourierProviderOptionsView.as_view(), name='courier_providers'),
    path('courier/locations/', views.CourierLocationOptionsView.as_view(), name='courier_locations'),
    path('courier/suggest-address/', views.CourierSuggestView.as_view(), name='courier_suggest'),
    path('courier/quote/', views.DeliveryQuoteView.as_view(), name='delivery_quote'),
    path('phone-history/', views.PhoneHistoryView.as_view(), name='phone_history'),
    path('og/<str:code>/', views.OpenGraphSessionView.as_view(), name='og_session'),

    # Merchant Dashboard Customer Management & Automation Controls
    path('merchant/customers/', views.MerchantCustomerListView.as_view(), name='merchant_customers'),
    path('merchant/customers/<uuid:customer_id>/', views.MerchantCustomerDetailView.as_view(), name='merchant_customer_detail'),
    path('merchant/automation-settings/', views.MerchantAutomationSettingsView.as_view(), name='merchant_automation_settings'),

    # Storefront Promotions, Flash Sales & Coupons
    path('promotions/', views.StorefrontPromotionsListView.as_view(), name='promotions_public'),
    path('merchant/promotions/', views.StorefrontPromotionManageView.as_view(), name='promotions_manage'),
    path('coupons/validate/', views.ValidateCouponView.as_view(), name='coupons_validate'),

    # Storefront Live Messaging & AI Token Streaming
    path('messages/threads/', message_views.StorefrontMessageThreadsView.as_view(), name='message_threads'),
    path('messages/history/', message_views.StorefrontMessageHistoryView.as_view(), name='message_history'),
    path('messages/control/', message_views.StorefrontMessageControlView.as_view(), name='message_control'),
    path('messages/stream/', message_views.StorefrontMessageStreamView.as_view(), name='message_stream'),
    path('messages/widget-action/', message_views.StorefrontMessageWidgetActionView.as_view(), name='message_widget_action'),
]
