from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.conf import settings
from .models import AgentSettings
from .serializers import AgentSettingsSerializer

class AgentSettingsDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AgentSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj, created = AgentSettings.objects.get_or_create(user=self.request.user)
        return obj

class PublicSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'support_email': settings.DEFAULT_FROM_EMAIL
        })
