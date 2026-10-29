from django.urls import path

from .admin_auth import AssunnahAdminLoginView, AssunnahAdminLogoutView, AssunnahAdminStatusView, AssunnahAdminPermission
from .views import (StateView, DistrictView, EntryView, BulkEntryView, EntryDetailView, ExportView, ArabicCorrectionView, ApproveCorrectionView, RejectCorrectionView, PromptConfigView, AutoFieldFillView, AutoFieldFillApproveView, ArabicSourceView, DistrictResolveView, DistrictDetailView, DistrictMapView)

urlpatterns = [
    path("admin/login/", AssunnahAdminLoginView.as_view()),
    path("admin/status/", AssunnahAdminStatusView.as_view()),
    path("admin/logout/", AssunnahAdminLogoutView.as_view()),
    path("admin/prompts/", PromptConfigView.as_view()),
    path("auto-fill/analyze/", AutoFieldFillView.as_view()),
    path("auto-fill/approve/", AutoFieldFillApproveView.as_view()),
    path("entries/arabic-source/", ArabicSourceView.as_view()),
    path("districts/resolve/", DistrictResolveView.as_view()),
    path("state/", StateView.as_view()),
    path("districts/", DistrictView.as_view()),
    path("districts/map/", DistrictMapView.as_view()),
    path("districts/<int:pk>/", DistrictDetailView.as_view()),
    path("entries/", EntryView.as_view()),
    path("entries/bulk/", BulkEntryView.as_view()),
    path("corrections/", ArabicCorrectionView.as_view()),
    path("entries/<int:pk>/approve-correction/", ApproveCorrectionView.as_view()),
    path("entries/<int:pk>/reject-correction/", RejectCorrectionView.as_view()),
    path("entries/<int:pk>/", EntryDetailView.as_view()),
    path("export/", ExportView.as_view()),
]
