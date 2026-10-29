from django.urls import path
from users.views import TeamMemberManageView, TeamRoleManageView, TeamPresenceToggleView

urlpatterns = [
    path('members/', TeamMemberManageView.as_view(), name='team-members'),
    path('roles/', TeamRoleManageView.as_view(), name='team-roles'),
    path('presence/', TeamPresenceToggleView.as_view(), name='team-presence'),
]
