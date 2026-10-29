from django.urls import path
from . import views

urlpatterns = [
    path('whatsapp/incoming/', views.whatsapp_incoming, name='whatsapp_incoming'),
    path('meta/incoming/', views.meta_incoming, name='meta_incoming'),
    path('telegram/incoming/', views.telegram_incoming, name='telegram_incoming'),
    path('tiktok/incoming/', views.tiktok_incoming, name='tiktok_incoming'),
    path('youtube/incoming/', views.youtube_incoming, name='youtube_incoming'),
]
