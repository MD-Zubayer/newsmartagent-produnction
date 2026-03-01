from django.urls import path
from .views import contact_create
from . import views

urlpatterns = [
   
    path('contact/create/', contact_create, name='contact_create'),
    path('notifications/', views.get_notification, name='get_notification'),
    path('notifications/<int:pk>/read/', views.mark_as_read, name='mark_as_read'),
    path('notifications/delete/<int:pk>/', views.delete_notification, name='delete_notification'),
]