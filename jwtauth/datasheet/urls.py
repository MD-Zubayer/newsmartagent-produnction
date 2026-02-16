from django.urls import path
from datasheet.views import SpreadsheetListCreateView, SpreadsheetDetailView



urlpatterns = [
    path('spreadsheets/', SpreadsheetListCreateView.as_view(), name='spreadsheet-list'),
    path('spreadsheets/<int:pk>/', SpreadsheetDetailView.as_view(), name='spreadsheet-detail')
    
]