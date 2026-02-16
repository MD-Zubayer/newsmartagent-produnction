from django.urls import path
from .views import contact_create


urlpatterns = [
   
    path('contact/create/', contact_create, name='contact_create'),
]