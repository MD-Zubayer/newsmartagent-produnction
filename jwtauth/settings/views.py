from rest_framework import generics, permissions
from .models import AgentSettings
from .serializers import AgentSettingsSerializer

class AgentSettingsDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = AgentSettingsSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        obj, created = AgentSettings.objects.get_or_create(user=self.request.user)
        return obj
