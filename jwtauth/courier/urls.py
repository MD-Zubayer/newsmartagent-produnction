from django.urls import path
from .views import (
    PathaoCourierConfigView,
    PathaoStoreListView,
    PathaoCityListView,
    PathaoZoneListView,
    PathaoAreaListView,
    PathaoBookOrderView
)

urlpatterns = [
    path('config/', PathaoCourierConfigView.as_view(), name='pathao-config'),
    path('stores/', PathaoStoreListView.as_view(), name='pathao-stores'),
    path('cities/', PathaoCityListView.as_view(), name='pathao-cities'),
    path('zones/', PathaoZoneListView.as_view(), name='pathao-zones'),
    path('areas/', PathaoAreaListView.as_view(), name='pathao-areas'),
    path('book-order/', PathaoBookOrderView.as_view(), name='pathao-book-order'),
]
