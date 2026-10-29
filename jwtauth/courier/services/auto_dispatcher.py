import logging
from decimal import Decimal
from django.utils import timezone
from users.models import CustomerOrder
from courier.models import (
    SteadFastCourierConfig, SteadFastBookingLog,
    PathaoCourierConfig, PathaoBookingLog,
    PathaoCity, PathaoZone, PathaoArea
)
from courier.views import SteadFastCourierClient, PathaoCourierClient

logger = logging.getLogger(__name__)


def _normalize_bd_phone(raw_phone: str) -> str:
    digits = ''.join(ch for ch in str(raw_phone or '') if ch.isdigit())
    if digits.startswith('880') and len(digits) == 13:
        digits = '0' + digits[3:]
    elif len(digits) == 10 and digits.startswith('1'):
        digits = '0' + digits
    return digits


def _resolve_pathao_location_ids(order: CustomerOrder) -> tuple:
    """
    Resolve and strictly validate Pathao (city_id, zone_id, area_id) parent-child hierarchy
    so SteadFast IDs or mismatched city/zone pairs are never sent to Pathao API.
    """
    raw_city_id = int(order.city_id) if (order.city_id and str(order.city_id).isdigit()) else None
    raw_zone_id = int(order.zone_id) if (order.zone_id and str(order.zone_id).isdigit()) else None
    raw_area_id = int(order.area_id) if (order.area_id and str(order.area_id).isdigit()) else None

    district_str = (order.district or '').strip()
    upazila_str = (order.upazila or '').strip()
    address_str = (order.address or '').strip()

    city_id = None
    zone_id = None
    area_id = None

    # 1. Validate raw order IDs ONLY if they form a valid Pathao hierarchy AND match order.district when present
    if raw_city_id and raw_zone_id:
        zone_check = PathaoZone.objects.filter(zone_id=raw_zone_id, city__city_id=raw_city_id).select_related('city').first()
        if zone_check:
            if not district_str or district_str.lower() in zone_check.city.city_name.lower() or zone_check.city.city_name.lower() in district_str.lower():
                city_id = zone_check.city.city_id
                zone_id = zone_check.zone_id
                if raw_area_id and PathaoArea.objects.filter(area_id=raw_area_id, zone__zone_id=zone_id).exists():
                    area_id = raw_area_id

    if city_id and zone_id:
        return city_id, zone_id, area_id

    # 2. Try resolve_courier_mapping_for_address (Redis + AI/heuristics)
    try:
        from storefront.services.address_suggest import resolve_courier_mapping_for_address
        mapped = resolve_courier_mapping_for_address(address_str, district_str, upazila_str)
        p_ids = (mapped.get('courier_location_ids') or {}).get('pathao') or {}
        m_city = int(p_ids['city_id']) if (p_ids.get('city_id') and str(p_ids.get('city_id')).isdigit()) else None
        m_zone = int(p_ids['zone_id']) if (p_ids.get('zone_id') and str(p_ids.get('zone_id')).isdigit()) else None
        m_area = int(p_ids['area_id']) if (p_ids.get('area_id') and str(p_ids.get('area_id')).isdigit()) else None
        if m_city and m_zone and PathaoZone.objects.filter(zone_id=m_zone, city__city_id=m_city).exists():
            city_id = m_city
            zone_id = m_zone
            if m_area and PathaoArea.objects.filter(area_id=m_area, zone__zone_id=zone_id).exists():
                area_id = m_area
    except Exception as map_err:
        logger.warning(f"[AutoCourier] Address mapping fallback error for Order #{order.id}: {map_err}")

    # 3. Direct PostgreSQL ORM lookup & parent-child enforcement
    if not city_id and district_str:
        city_obj = (
            PathaoCity.objects.filter(city_name__iexact=district_str).first()
            or PathaoCity.objects.filter(city_name__icontains=district_str).first()
        )
        if city_obj:
            city_id = city_obj.city_id

    if not city_id and address_str:
        for c in PathaoCity.objects.all():
            if c.city_name.strip().lower() in address_str.lower():
                city_id = c.city_id
                break

    if city_id and not zone_id:
        if upazila_str:
            zone_obj = (
                PathaoZone.objects.filter(city__city_id=city_id, zone_name__iexact=upazila_str).select_related('city').first()
                or PathaoZone.objects.filter(city__city_id=city_id, zone_name__icontains=upazila_str).select_related('city').first()
            )
            if zone_obj:
                zone_id = zone_obj.zone_id
                city_id = zone_obj.city.city_id

        if not zone_id and address_str:
            for z in PathaoZone.objects.filter(city__city_id=city_id).select_related('city'):
                if len(z.zone_name.strip()) >= 3 and z.zone_name.strip().lower() in address_str.lower():
                    zone_id = z.zone_id
                    city_id = z.city.city_id
                    break

        if not zone_id:
            sadar_zone = (
                PathaoZone.objects.filter(city__city_id=city_id, zone_name__icontains='sadar').select_related('city').first()
                or PathaoZone.objects.filter(city__city_id=city_id).select_related('city').first()
            )
            if sadar_zone:
                zone_id = sadar_zone.zone_id
                city_id = sadar_zone.city.city_id

    if zone_id and not area_id and address_str:
        for a in PathaoArea.objects.filter(zone__zone_id=zone_id):
            if len(a.area_name.strip()) >= 3 and a.area_name.strip().lower() in address_str.lower():
                area_id = a.area_id
                break

    # Final strict parent-child check
    if zone_id:
        valid_zone = PathaoZone.objects.filter(zone_id=zone_id).select_related('city').first()
        if valid_zone:
            city_id = valid_zone.city.city_id
            if area_id and not PathaoArea.objects.filter(area_id=area_id, zone__zone_id=zone_id).exists():
                area_id = None
        else:
            zone_id = None
            area_id = None

    return city_id, zone_id, area_id


def _append_order_note(order: CustomerOrder, note_line: str):
    existing = (order.extra_info or '').strip()
    # Remove old auto-booking error lines before adding new status/error
    cleaned_lines = [
        line for line in existing.splitlines()
        if not line.strip().startswith('Courier Auto-Booking Error:')
    ]
    cleaned_lines.append(note_line)
    order.extra_info = '\n'.join(cleaned_lines).strip()
    order.save(update_fields=['extra_info', 'updated_at'])


def attempt_auto_courier_booking(order: CustomerOrder) -> dict:
    """
    Attempts to automatically dispatch and book a confirmed order into the merchant's configured courier service
    (SteadFast or Pathao) if auto-booking is enabled on their profile.
    """
    merchant = order.user
    profile = getattr(merchant, 'profile', None)

    if not profile or not getattr(profile, 'auto_courier_booking', False):
        logger.info(f"[AutoCourier] Auto courier booking disabled for merchant {merchant.id}. Skipping Order #{order.id}.")
        return {'status': 'skipped', 'reason': 'auto_booking_disabled'}

    # If already booked in Steadfast or Pathao, skip duplicate booking
    if SteadFastBookingLog.objects.filter(order=order).exists() or PathaoBookingLog.objects.filter(order=order).exists():
        logger.info(f"[AutoCourier] Order #{order.id} is already booked in courier. Skipping.")
        return {'status': 'already_booked'}

    # Ignore 'manual' placeholder and ONLY honor order.courier if it differs from default AND customer explicitly requested it;
    # otherwise always start with the merchant's default_courier_provider.
    default_provider = (getattr(profile, 'default_courier_provider', 'steadfast') or 'steadfast').strip().lower()
    if default_provider not in ('pathao', 'steadfast'):
        default_provider = 'steadfast'
    provider = default_provider

    total_cod = float(order.price + (order.delivery_charge or Decimal('0.00')))
    merchant_order_id = f"ORD-{order.id}"
    clean_phone = _normalize_bd_phone(order.phone_number)
    last_error = None

    # Build ordered provider attempt list: preferred provider first, then fallback to the other active provider
    providers_to_try = [provider]
    if 'steadfast' not in providers_to_try:
        providers_to_try.append('steadfast')
    if 'pathao' not in providers_to_try:
        providers_to_try.append('pathao')

    for current_provider in providers_to_try:
        if current_provider == 'steadfast':
            config = SteadFastCourierConfig.objects.filter(user=merchant, is_active=True).first()
            if not config:
                continue
            try:
                client = SteadFastCourierClient(config)
                addr_parts = [str(order.address or '').strip()]
                if order.upazila and order.upazila.lower() not in (order.address or '').lower():
                    addr_parts.append(str(order.upazila))
                if order.district and order.district.lower() not in (order.address or '').lower():
                    addr_parts.append(str(order.district))
                full_addr = ", ".join([p for p in addr_parts if p])[:250]

                payload = {
                    "invoice": merchant_order_id,
                    "recipient_name": str(order.customer_name),
                    "recipient_phone": clean_phone,
                    "recipient_address": full_addr,
                    "cod_amount": int(round(total_cod)),
                    "item_description": str(order.product_name or 'Order Item')[:250],
                    "note": str(order.special_instruction or '')[:250]
                }
                res = client.create_order(payload)
                consignment_id = res.get("consignment", {}).get("consignment_id")
                if consignment_id:
                    SteadFastBookingLog.objects.create(
                        order=order,
                        consignment_id=consignment_id,
                        merchant_order_id=merchant_order_id,
                        status="pending",
                        response_data=res
                    )
                    order.status = "shipped"
                    order.courier = "steadfast"
                    tracking_info = f"SteadFast Courier Tracking ID: {consignment_id}"
                    _append_order_note(order, tracking_info)
                    order.save(update_fields=['status', 'courier', 'updated_at'])
                    logger.info(f"[AutoCourier] Successfully booked Order #{order.id} in SteadFast! Consignment ID: {consignment_id}")
                    return {'status': 'booked', 'provider': 'steadfast', 'consignment_id': consignment_id}
                else:
                    last_error = f"SteadFast returned no consignment_id: {res}"
                    logger.warning(f"[AutoCourier] {last_error}")
            except Exception as e:
                last_error = f"SteadFast Error: {str(e)}"
                logger.error(f"[AutoCourier] SteadFast booking failed for Order #{order.id}: {e}")

        elif current_provider == 'pathao':
            pathao_config = PathaoCourierConfig.objects.filter(user=merchant, is_active=True).first()
            if not pathao_config:
                continue

            try:
                client = PathaoCourierClient(pathao_config)

                # Auto-fetch and save first/default store_id if not set on config
                store_id_val = pathao_config.store_id
                if not store_id_val or not str(store_id_val).isdigit():
                    stores = client.get_stores()
                    if stores and isinstance(stores, list) and len(stores) > 0:
                        default_st = next((s for s in stores if s.get('is_default_store')), stores[0])
                        store_id_val = default_st.get('store_id')
                        if store_id_val:
                            pathao_config.store_id = str(store_id_val)
                            pathao_config.save(update_fields=['store_id'])

                if not store_id_val or not str(store_id_val).isdigit():
                    last_error = "Pathao Store ID missing (create a store in Pathao first)"
                    logger.warning(f"[AutoCourier] {last_error} for merchant {merchant.id}.")
                    continue

                city_id, zone_id, area_id = _resolve_pathao_location_ids(order)
                addr_text = str(order.address or '').strip()
                if order.upazila and order.upazila.lower() not in addr_text.lower():
                    addr_text = f"{addr_text}, {order.upazila}".strip(", ")
                if order.district and order.district.lower() not in addr_text.lower():
                    addr_text = f"{addr_text}, {order.district}".strip(", ")
                # Pathao requires recipient_address to be at least 10 characters
                if len(addr_text) < 10:
                    addr_text = f"{addr_text}, Bangladesh"

                pathao_payload = {
                    "store_id": int(store_id_val),
                    "merchant_order_id": merchant_order_id,
                    "recipient_name": str(order.customer_name or "Customer")[:100],
                    "recipient_phone": clean_phone,
                    "recipient_address": addr_text[:220],
                    "amount_to_collect": int(round(total_cod)),
                    "item_quantity": max(1, order.item_quantity or 1),
                    "item_weight": float(order.item_weight or 0.5),
                    "item_type": 2,
                    "delivery_type": 48,
                    "item_description": str(order.product_name or 'Order Item')[:250],
                    "special_instruction": str(order.special_instruction or '')[:250]
                }
                if city_id:
                    pathao_payload["recipient_city"] = int(city_id)
                if zone_id:
                    pathao_payload["recipient_zone"] = int(zone_id)
                if area_id:
                    pathao_payload["recipient_area"] = int(area_id)

                try:
                    res = client.create_order(pathao_payload)
                except Exception as first_err:
                    # If Pathao rejects city/zone/area hierarchy (e.g. sandbox vs live mismatch),
                    # retry once using Pathao's address auto-parsing (without explicit location IDs)
                    err_str = str(first_err)
                    if any(k in err_str for k in ("recipient_zone", "recipient_area", "recipient_city", "does not belong")):
                        logger.warning(f"[AutoCourier] Retrying Pathao Order #{order.id} without explicit location IDs due to: {err_str}")
                        fallback_payload = {
                            k: v for k, v in pathao_payload.items()
                            if k not in ("recipient_city", "recipient_zone", "recipient_area")
                        }
                        res = client.create_order(fallback_payload)
                    else:
                        raise first_err
                consignment_id = res.get("data", {}).get("consignment_id")
                if consignment_id:
                    PathaoBookingLog.objects.create(
                        order=order,
                        consignment_id=consignment_id,
                        merchant_order_id=merchant_order_id,
                        status="pending",
                        response_data=res
                    )
                    order.status = "shipped"
                    order.courier = "pathao"
                    if city_id:
                        order.city_id = str(city_id)
                    if zone_id:
                        order.zone_id = str(zone_id)
                    if area_id:
                        order.area_id = str(area_id)
                    tracking_info = f"Pathao Courier Tracking ID: {consignment_id}"
                    _append_order_note(order, tracking_info)
                    order.save(update_fields=['status', 'courier', 'city_id', 'zone_id', 'area_id', 'updated_at'])
                    logger.info(f"[AutoCourier] Successfully booked Order #{order.id} in Pathao! Consignment ID: {consignment_id}")
                    return {'status': 'booked', 'provider': 'pathao', 'consignment_id': consignment_id}
                else:
                    last_error = f"Pathao returned no consignment_id: {res}"
                    logger.warning(f"[AutoCourier] {last_error}")
            except Exception as e:
                last_error = f"Pathao Error: {str(e)}"
                logger.error(f"[AutoCourier] Pathao booking failed for Order #{order.id}: {e}")

    if last_error:
        _append_order_note(order, f"Courier Auto-Booking Error: {last_error[:200]}")
        return {'status': 'failed', 'reason': last_error}

    return {'status': 'unbooked', 'reason': 'no_active_courier_credentials'}
