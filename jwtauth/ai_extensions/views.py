from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Extension, ExtensionAssignment, ExtensionExecutionLog, ExtensionVersion
from .serializers import ExtensionAssignmentSerializer, ExtensionExecutionLogSerializer, ExtensionSerializer, ExtensionVersionSerializer


class StaffOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.method in permissions.SAFE_METHODS or request.user.is_staff))


class ExtensionViewSet(viewsets.ModelViewSet):
    queryset = Extension.objects.prefetch_related("versions").all()
    serializer_class = ExtensionSerializer
    permission_classes = (StaffOrReadOnly,)

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get("search")
        category = self.request.query_params.get("category")
        status = self.request.query_params.get("status")
        # Regular dashboard users only see extensions explicitly exposed by admin.
        # Staff can inspect hidden extensions with ?include_hidden=true.
        if not self.request.user.is_staff or self.request.query_params.get("include_hidden") != "true":
            queryset = queryset.filter(dashboard_visible=True)
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(key__icontains=search) | Q(description__icontains=search))
        if category:
            queryset = queryset.filter(category=category)
        if status == "enabled":
            queryset = queryset.filter(is_enabled=True)
        elif status == "disabled":
            queryset = queryset.filter(is_enabled=False)
        return queryset

    @action(detail=True, methods=("post",))
    def enable(self, request, pk=None):
        extension = self.get_object()
        extension.is_enabled = True
        extension.save(update_fields=("is_enabled", "updated_at"))
        return Response(self.get_serializer(extension).data)

    @action(detail=True, methods=("post",))
    def disable(self, request, pk=None):
        extension = self.get_object()
        extension.is_enabled = False
        extension.save(update_fields=("is_enabled", "updated_at"))
        ExtensionAssignment.objects.filter(extension=extension).update(is_enabled=False)
        return Response(self.get_serializer(extension).data)


class ExtensionVersionViewSet(viewsets.ModelViewSet):
    queryset = ExtensionVersion.objects.select_related("extension").all()
    serializer_class = ExtensionVersionSerializer
    permission_classes = (StaffOrReadOnly,)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ExtensionAssignmentViewSet(viewsets.ModelViewSet):
    queryset = ExtensionAssignment.objects.select_related("extension", "version", "agent", "user").all()
    serializer_class = ExtensionAssignmentSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def _save_assignment(self, serializer, **save_kwargs):
        assignment = serializer.save(**save_kwargs)
        extension = assignment.extension
        if assignment.is_enabled and not extension.is_enabled:
            extension.is_enabled = True
            extension.save(update_fields=("is_enabled", "updated_at"))
        if assignment.is_enabled and not extension.allow_multiple_active_versions:
            filters = {
                "extension": extension,
                "scope": assignment.scope,
                "is_enabled": True,
            }
            if assignment.scope == "agent":
                filters["agent"] = assignment.agent
            elif assignment.scope == "user":
                filters["user"] = assignment.user
            ExtensionAssignment.objects.filter(**filters).exclude(pk=assignment.pk).update(is_enabled=False)
        return assignment

    def perform_create(self, serializer):
        scope = serializer.validated_data.get("scope", "global")
        agent = serializer.validated_data.get("agent")
        user = serializer.validated_data.get("user")
        if not self.request.user.is_staff:
            if scope == "user":
                if user and user.pk != self.request.user.pk:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You can only enable extensions for your own user scope.")
                user = self.request.user
            elif scope != "agent" or not agent or agent.user_id != self.request.user.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only configure extensions for your own agent.")
        with transaction.atomic():
            save_kwargs = {"user": user} if not self.request.user.is_staff and scope == "user" else {}
            self._save_assignment(serializer, **save_kwargs)

    def perform_update(self, serializer):
        instance = serializer.instance
        scope = serializer.validated_data.get("scope", instance.scope)
        agent = serializer.validated_data.get("agent", instance.agent)
        user = serializer.validated_data.get("user", instance.user)
        if not self.request.user.is_staff:
            if scope == "user":
                if user and user.pk != self.request.user.pk:
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied("You can only enable extensions for your own user scope.")
                user = self.request.user
            elif scope != "agent" or not agent or agent.user_id != self.request.user.id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You can only configure extensions for your own agent.")
        with transaction.atomic():
            save_kwargs = {"user": user} if not self.request.user.is_staff and scope == "user" else {}
            self._save_assignment(serializer, **save_kwargs)


    def get_queryset(self):
        queryset = super().get_queryset()
        if self.request.user.is_staff:
            return queryset
        return queryset.filter(Q(agent__user=self.request.user) | Q(scope="user", user=self.request.user))



class ExtensionExecutionLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ExtensionExecutionLog.objects.select_related("extension", "version", "agent", "user").all()
    serializer_class = ExtensionExecutionLogSerializer
    permission_classes = (StaffOrReadOnly,)

