import hmac

from django.conf import settings
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView


SESSION_KEY = "assunnah_admin_authenticated"


def is_assunnah_admin(request):
    return request.session.get(SESSION_KEY) is True


class AssunnahAdminPermission(BasePermission):
    message = "Admin password required"

    def has_permission(self, request, view):
        return is_assunnah_admin(request)


class AssunnahAdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        configured_password = getattr(settings, "ASSUNNAH_ADMIN_PASSWORD", "")
        submitted_password = str(request.data.get("password", ""))
        if not configured_password:
            return Response({"detail": "As-Sunnah admin password is not configured"}, status=503)
        if not hmac.compare_digest(submitted_password, configured_password):
            request.session[SESSION_KEY] = False
            return Response({"detail": "Admin password সঠিক নয়"}, status=401)
        request.session[SESSION_KEY] = True
        request.session.set_expiry(60 * 60 * 8)
        return Response({"authenticated": True})


class AssunnahAdminStatusView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"authenticated": is_assunnah_admin(request)})


class AssunnahAdminLogoutView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        request.session.pop(SESSION_KEY, None)
        return Response({"authenticated": False})
