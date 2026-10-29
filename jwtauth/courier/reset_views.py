import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.authentication import CookieJWTAuthentication
from users.models import CustomerOrder

logger = logging.getLogger(__name__)


class ResetCourierBookingView(APIView):
    """
    POST /api/courier/reset-booking/
    Manually unlinks/resets a courier booking from the seller dashboard so the order
    reverts from 'shipped' to 'confirmed' and can be re-booked or sent to another courier.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import PathaoBookingLog, SteadFastBookingLog, CourierTimelineEvent
        order_id = request.data.get("order_id")
        if not order_id:
            return Response({"error": "order_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        owner = request.user.get_workspace_owner() if hasattr(request.user, "get_workspace_owner") else request.user
        order = get_object_or_404(CustomerOrder, id=order_id, user=owner)

        now = timezone.now()
        reset_provider = None
        reset_consignment = None

        for plog in PathaoBookingLog.objects.filter(order=order).exclude(status__in=['cancelled', 'deleted']):
            reset_provider = 'pathao'
            reset_consignment = plog.consignment_id
            plog.status = 'cancelled'
            plog.save(update_fields=['status', 'updated_at'])

        for slog in SteadFastBookingLog.objects.filter(order=order).exclude(status__in=['cancelled', 'deleted']):
            reset_provider = 'steadfast'
            reset_consignment = slog.consignment_id
            slog.status = 'cancelled'
            slog.save(update_fields=['status', 'updated_at'])

        if order.status == 'shipped':
            order.status = 'confirmed'
            order.updated_at = now
            order.save(update_fields=['status', 'updated_at'])

        status_label = "ড্যাশবোর্ড থেকে কুরিয়ার বুকিং রিসেট করা হয়েছে"
        CourierTimelineEvent.objects.create(
            order=order,
            provider=reset_provider or order.courier or 'steadfast',
            consignment_id=str(reset_consignment or ''),
            event_name='manual.booking_reset',
            status_label=status_label,
            reason='বিক্রেতা ড্যাশবোর্ড থেকে কুরিয়ার বুকিং বাতিল/রিসেট করেছেন',
            raw_payload={"reset_by": request.user.id, "reset_at": now.isoformat()},
        )

        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()
            if channel_layer and order.user_id:
                async_to_sync(channel_layer.group_send)(
                    f"user_{order.user_id}",
                    {
                        "type": "send_notification",
                        "content": {
                            "type": "courier_status_update",
                            "order_id": order.id,
                            "order_status": order.status,
                            "courier_status": "cancelled",
                            "courier_provider": reset_provider or "steadfast",
                            "consignment_id": reset_consignment or "",
                            "event_name": "manual.booking_reset",
                            "status_label": status_label,
                            "reason": "",
                            "customer_name": order.customer_name,
                        },
                    },
                )
        except Exception as ws_err:
            logger.debug(f"[ResetCourierBooking] WebSocket broadcast error: {ws_err}")

        from users.serializers import CustomerOrderSerializer
        serialized_order = CustomerOrderSerializer(order, context={'request': request}).data

        return Response({
            "status": "success",
            "message": "কুরিয়ার বুকিং সফলভাবে রিসেট করা হয়েছে। এখন পুনরায় বুক করতে পারবেন।",
            "order": serialized_order,
        }, status=status.HTTP_200_OK)

