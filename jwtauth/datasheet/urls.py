from django.urls import path
from datasheet.views import (
    SpreadsheetListCreateView, 
    SpreadsheetDetailView,
    RowImageUploadView,
    RowImagesListCreateView,
    RowImageDetailView,
    RowImageSetPrimaryView,
    RowImagePresignedURLView
)

urlpatterns = [
    path('spreadsheets/', SpreadsheetListCreateView.as_view(), name='spreadsheet-list'),
    path('spreadsheets/<int:pk>/', SpreadsheetDetailView.as_view(), name='spreadsheet-detail'),
    path('spreadsheets/<int:pk>/row-image/', RowImageUploadView.as_view(), name='spreadsheet-row-image'),
    
    # 🖼️ New multi-image endpoints
    path('spreadsheets/<int:sheet_id>/rows/<int:row_index>/images/', RowImagesListCreateView.as_view(), name='row-images-list'),
    path('spreadsheets/<int:sheet_id>/row/images/<int:image_id>/', RowImageDetailView.as_view(), name='row-image-detail'),
    path('spreadsheets/<int:sheet_id>/row/images/<int:image_id>/set-primary/', RowImageSetPrimaryView.as_view(), name='row-image-set-primary'),
    
    # 🔐 Platform-restricted presigned URLs
    path('spreadsheets/<int:sheet_id>/row-image-presigned-url/', RowImagePresignedURLView.as_view(), name='row-image-presigned-url'),
]