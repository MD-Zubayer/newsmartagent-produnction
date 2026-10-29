from django.urls import path
from .views import (
    PathaoCourierConfigView,
    PathaoStoreListView,
    PathaoStoreCreateView,
    PathaoCityListView,
    PathaoZoneListView,
    PathaoAreaListView,
    PathaoBookOrderView,
    PathaoOrderInfoView,
    PathaoPriceCalculatorView,
    SteadFastCourierConfigView,
    SteadFastCityListView,
    SteadFastAreaListView,
    SteadFastBookOrderView,
    SteadFastOrderInfoView,
    SteadFastPriceCalculatorView,
    PathaoWebhookView,
    SteadFastWebhookView
)
from .reset_views import ResetCourierBookingView

urlpatterns = [
    # Courier Booking Reset (Unlink / Reset for re-booking)
    path('reset-booking/', ResetCourierBookingView.as_view(), name='courier-reset-booking'),
    # Courier Webhook endpoints (Real-time parcel status sync - with and without trailing slash)
    path('webhooks/pathao/', PathaoWebhookView.as_view(), name='courier-webhook-pathao'),
    path('webhooks/pathao', PathaoWebhookView.as_view(), name='courier-webhook-pathao-noslash'),
    path('webhooks/pathao/<str:merchant_identifier>/', PathaoWebhookView.as_view(), name='courier-webhook-pathao-merchant'),
    path('webhooks/pathao/<str:merchant_identifier>', PathaoWebhookView.as_view(), name='courier-webhook-pathao-merchant-noslash'),
    path('webhooks/steadfast/', SteadFastWebhookView.as_view(), name='courier-webhook-steadfast'),
    path('webhooks/steadfast', SteadFastWebhookView.as_view(), name='courier-webhook-steadfast-noslash'),
    path('webhooks/steadfast/<str:merchant_identifier>/', SteadFastWebhookView.as_view(), name='courier-webhook-steadfast-merchant'),
    path('webhooks/steadfast/<str:merchant_identifier>', SteadFastWebhookView.as_view(), name='courier-webhook-steadfast-merchant-noslash'),

    # Pathao routes
    path('config/', PathaoCourierConfigView.as_view(), name='pathao-config'),
    path('stores/', PathaoStoreListView.as_view(), name='pathao-stores'),
    path('stores/create/', PathaoStoreCreateView.as_view(), name='pathao-store-create'),
    path('cities/', PathaoCityListView.as_view(), name='pathao-cities'),
    path('zones/', PathaoZoneListView.as_view(), name='pathao-zones'),
    path('areas/', PathaoAreaListView.as_view(), name='pathao-areas'),
    path('book-order/', PathaoBookOrderView.as_view(), name='pathao-book-order'),
    path('order-info/<str:consignment_id>/', PathaoOrderInfoView.as_view(), name='pathao-order-info'),
    path('price-calculator/', PathaoPriceCalculatorView.as_view(), name='pathao-price-calculator'),
    
    # SteadFast routes
    path('steadfast/config/', SteadFastCourierConfigView.as_view(), name='steadfast-config'),
    path('steadfast/cities/', SteadFastCityListView.as_view(), name='steadfast-cities'),
    path('steadfast/areas/', SteadFastAreaListView.as_view(), name='steadfast-areas'),
    path('steadfast/book-order/', SteadFastBookOrderView.as_view(), name='steadfast-book-order'),
    path('steadfast/order-info/<str:consignment_id>/', SteadFastOrderInfoView.as_view(), name='steadfast-order-info'),
    path('steadfast/price-calculator/', SteadFastPriceCalculatorView.as_view(), name='steadfast-price-calculator'),
]
