from rest_framework import serializers
from chat.models import Contact




class ContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = Contact
        fields = ['name', 'email', 'subjects', 'messages']
        