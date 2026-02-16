from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from chat.serializer import ContactSerializer


# Create your views here.


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def contact_create(request):
    serializer = ContactSerializer(data=request.data)

    if serializer.is_valid():
        serializer.save()

        return Response({
            "message": "Success! We received your message."}, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            