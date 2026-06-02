from django.urls import path
from datasheet.views import SpreadsheetListCreateView, SpreadsheetDetailView
from datasheet.views import RowImageUploadView



urlpatterns = [
    path('spreadsheets/', SpreadsheetListCreateView.as_view(), name='spreadsheet-list'),
    path('spreadsheets/<int:pk>/', SpreadsheetDetailView.as_view(), name='spreadsheet-detail')
    ,
    path('spreadsheets/<int:pk>/row-image/', RowImageUploadView.as_view(), name='spreadsheet-row-image')
    
]