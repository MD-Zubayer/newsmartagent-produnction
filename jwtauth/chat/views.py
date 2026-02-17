from django.shortcuts import render
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from chat.serializer import ContactSerializer, NotificationSerializer
from chat.models import Notification

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

            
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notification(request):
    
    notifications = Notification.objects.filter(user=request.user).order_by('-created_at')[:20]
    serializer = NotificationSerializer(notifications, many=True)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_as_read(request, pk):
    try:
        notifcation = Notification.objects.get(pk=pk, user=request.user)
        notifcation.is_read = True
        notifcation.save()
        return Response({'status': 'success', 'message': 'Notification marked as read'})
    except Notification.DoesNotExist:
        return Response({'error': 'Not found'}, status=404)

    return Response({'error': 'Something went wrong'}, status=400)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk):
    try:
        notification = Notification.objects.get(pk=pk, user=request.user)
        notification.delete()

        return Response({'status': 'success', 'message': 'Notification deleted successfully'})
    except Notification.DoesNotExist:
        return Response({'error': 'Notification not found'}, status=404)