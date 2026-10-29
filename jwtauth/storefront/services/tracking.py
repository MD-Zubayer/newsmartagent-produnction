import logging
from users.models import CustomerOrder
from courier.models import PathaoBookingLog, SteadFastBookingLog

logger = logging.getLogger(__name__)


def build_order_tracking_timeline(order: CustomerOrder) -> dict:
    """
    Constructs a rich, real-time tracking timeline for a CustomerOrder.
    Checks courier bookings (Pathao / SteadFast) for live status.
    """
    status = (order.status or 'pending').lower()
    created_at = order.created_at.isoformat() if order.created_at else None
    updated_at = order.updated_at.isoformat() if order.updated_at else None

    # Courier consignment info
    courier_name = None
    consignment_id = None
    courier_status = None
    courier_latest_label = None

    from courier.models import CourierTimelineEvent
    latest_event = CourierTimelineEvent.objects.filter(order=order).order_by('-created_at').first()
    if latest_event:
        courier_latest_label = latest_event.status_label

    pathao_log = PathaoBookingLog.objects.filter(order=order).order_by('-created_at').first()
    if pathao_log:
        courier_name = "Pathao Courier"
        consignment_id = pathao_log.consignment_id
        courier_status = latest_event.event_name if latest_event else pathao_log.status

    if not consignment_id:
        sf_log = SteadFastBookingLog.objects.filter(order=order).order_by('-created_at').first()
        if sf_log:
            courier_name = "Steadfast Courier"
            consignment_id = sf_log.consignment_id
            courier_status = latest_event.event_name if latest_event else sf_log.status

    # Map status into stages
    # Standard sequence: Placed (1) -> Confirmed (2) -> Handed to Courier (3) -> In Transit (4) -> Delivered (5)
    # Special: cancelled, returned

    is_cancelled = status == 'cancelled'
    is_returned = status == 'returned'

    stage_level = 1
    if status == 'confirmed':
        stage_level = 2
    elif consignment_id:
        stage_level = 3
    if status == 'shipped':
        stage_level = 4
    elif status == 'delivered':
        stage_level = 5

    timeline_steps = [
        {
            "id": "placed",
            "title": "অর্ডার গৃহীত হয়েছে",
            "description": "আপনার অর্ডারটি সফলভাবে সিস্টেমে যুক্ত হয়েছে।",
            "timestamp": created_at,
            "is_completed": True,
            "is_current": stage_level == 1 and not (is_cancelled or is_returned)
        },
        {
            "id": "confirmed",
            "title": "অর্ডার কনফার্মড",
            "description": "মার্চেন্ট আপনার অর্ডারটি ভেরিফাই ও কনফার্ম করেছেন।",
            "timestamp": updated_at if stage_level >= 2 else None,
            "is_completed": stage_level >= 2,
            "is_current": stage_level == 2 and not (is_cancelled or is_returned)
        },
        {
            "id": "courier_booked",
            "title": "কুরিয়ারে বুকিং সম্পন্ন",
            "description": f"{courier_name or 'কুরিয়ার পার্টনার'}-এ পার্সেল হ্যান্ডওভার করা হয়েছে।" if consignment_id else "কুরিয়ার বুকিং প্রক্রিয়ার মধ্যে আছে।",
            "consignment_id": consignment_id,
            "courier_name": courier_name,
            "timestamp": updated_at if stage_level >= 3 else None,
            "is_completed": stage_level >= 3,
            "is_current": stage_level == 3 and not (is_cancelled or is_returned)
        },
        {
            "id": "in_transit",
            "title": "ডেলিভারির পথে (In Transit)",
            "description": "পার্সেলটি আপনার ঠিকানার কাছাকাছি ডেলিভারি হাবে যাচ্ছে।",
            "timestamp": updated_at if stage_level >= 4 else None,
            "is_completed": stage_level >= 4,
            "is_current": stage_level == 4 and not (is_cancelled or is_returned)
        },
        {
            "id": "delivered",
            "title": "ডেলিভার্ড",
            "description": "পণ্যটি সফলভাবে গ্রাহকের কাছে পৌঁছে গেছে।",
            "timestamp": updated_at if stage_level >= 5 else None,
            "is_completed": stage_level >= 5,
            "is_current": stage_level == 5 and not (is_cancelled or is_returned)
        }
    ]

    if is_cancelled:
        timeline_steps.append({
            "id": "cancelled",
            "title": "অর্ডার বাতিল করা হয়েছে",
            "description": "গ্রাহকের অনুরোধে বা কোনো সমস্যার কারণে অর্ডারটি বাতিল হয়েছে।",
            "timestamp": updated_at,
            "is_completed": True,
            "is_current": True,
            "is_error": True
        })
    elif is_returned:
        timeline_steps.append({
            "id": "returned",
            "title": "পার্সেল রিটার্ন হয়েছে",
            "description": "পার্সেলটি সফলভাবে ডেলিভারি না হওয়ায় মার্চেন্টের কাছে ফিরে এসেছে।",
            "timestamp": updated_at,
            "is_completed": True,
            "is_current": True,
            "is_error": True
        })

    return {
        "order_id": order.id,
        "public_id": str(order.public_id),
        "status": status,
        "stage_level": stage_level,
        "is_cancelled": is_cancelled,
        "is_returned": is_returned,
        "courier_name": courier_name,
        "consignment_id": consignment_id,
        "courier_status": courier_status,
        "steps": timeline_steps
    }
