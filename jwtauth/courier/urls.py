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
    SteadFastPriceCalculatorView
)

urlpatterns = [
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
