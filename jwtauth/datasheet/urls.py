from django.urls import path
from datasheet.views import (
    SpreadsheetListCreateView, 
    SpreadsheetDetailView,
    ProductListCreateView,
    ProductDetailView,
    ProductSearchView,
    ProductGalleryImageView,
    ProductGalleryImageDetailView,
    ProductImageAssetListCreateView,
    ProductImageAssetReorderView,
    ProductImageAssetBulkEmbedView,
    ProductImageAssetDetailView,
    ProductImageAssetLinkView,
    ProductImageAssetUnlinkView,
    ProductArchiveView,
    ProductActivityView,
    ProductGalleryImageMutationView,
    ProductGalleryReorderView,
    RowImageUploadView,
    RowImagesListCreateView,
    RowImageDetailView,
    RowImageSetPrimaryView,
    RowImagePresignedURLView,
    ProductCategoryListCreateView,
    ProductFinancialSummaryView,
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

urlpatterns += [
    path("products/search/", ProductSearchView.as_view(), name="product-search"),
    path("product-image-library/", ProductImageAssetListCreateView.as_view(), name="product-image-library"),
    path("product-image-library/reorder/", ProductImageAssetReorderView.as_view(), name="product-image-library-reorder"),
    path("product-image-library/embed/", ProductImageAssetBulkEmbedView.as_view(), name="product-image-library-embed"),
    path("product-image-library/<int:pk>/", ProductImageAssetDetailView.as_view(), name="product-image-library-detail"),
    path("product-image-library/<int:asset_id>/link/", ProductImageAssetLinkView.as_view(), name="product-image-library-link"),
    path("product-image-library/<int:asset_id>/links/<int:link_id>/", ProductImageAssetUnlinkView.as_view(), name="product-image-library-unlink"),
    path("products/<int:pk>/gallery/", ProductGalleryImageView.as_view(), name="product-gallery"),
    path("products/<int:pk>/gallery/<int:image_id>/", ProductGalleryImageDetailView.as_view(), name="product-gallery-detail"),
    path("products/<int:pk>/gallery/<int:image_id>/edit/", ProductGalleryImageMutationView.as_view(), name="product-gallery-edit"),
    path("products/<int:pk>/gallery/reorder/", ProductGalleryReorderView.as_view(), name="product-gallery-reorder"),
    path("products/<int:pk>/archive/", ProductArchiveView.as_view(), name="product-archive"),
    path("products/<int:pk>/activity/", ProductActivityView.as_view(), name="product-activity"),
    path("products/categories/", ProductCategoryListCreateView.as_view(), name="product-categories"),
    path("products/financial-summary/", ProductFinancialSummaryView.as_view(), name="product-financial-summary"),
    path("products/", ProductListCreateView.as_view(), name="product-list"),
    path("products/<int:pk>/", ProductDetailView.as_view(), name="product-detail"),
]