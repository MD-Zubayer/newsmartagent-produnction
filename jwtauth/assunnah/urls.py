from django.urls import path

from .views import PasswordView, StateView, DistrictView, EntryView, BulkEntryView, EntryDetailView, ExportView

urlpatterns = [
    path("password/", PasswordView.as_view()),
    path("state/", StateView.as_view()),
    path("districts/", DistrictView.as_view()),
    path("entries/", EntryView.as_view()),
    path("entries/bulk/", BulkEntryView.as_view()),
    path("entries/<int:pk>/", EntryDetailView.as_view()),
    path("export/", ExportView.as_view()),
]
