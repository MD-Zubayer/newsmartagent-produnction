from django.contrib import admin

from .models import Collection, District, Entry

admin.site.register([Collection, District, Entry])

