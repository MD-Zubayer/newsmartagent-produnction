"""
jwtauth/aiAgent/tools/courier_validation_tool.py

AI Function Calling Tool: Courier Location Validation & Smart Suggestion
Validates customer's parsed address against the merchant's active courier provider
(Pathao or Steadfast). If sub-area or zone is ambiguous or missing, returns
nearby courier coverage suggestions so AI can clarify with the customer before finalizing.
"""
import logging
from typing import Dict, Any, List, Optional
from courier.models import (
    PathaoCourierConfig, PathaoCity, PathaoZone, PathaoArea,
    SteadFastCourierConfig, SteadFastCity, SteadFastArea
)
from courier.utils.redis_courier_cache import match_address_redis

logger = logging.getLogger('aiAgent')


def get_courier_validation_tool_definition() -> Dict[str, Any]:
    """
    OpenAI & Gemini Function Calling Tool Specification for Courier Validation.
    """
    return {
        "name": "validate_courier_coverage",
        "description": (
            "Validates customer delivery address against the merchant's active courier provider (Pathao or Steadfast). "
            "Call this tool whenever customer provides district, upazila/thana, or address. "
            "Returns matched location IDs or nearby available sub-areas/unions if the sub-area is ambiguous."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "district": {
                    "type": "string",
                    "description": "District name in English (e.g. 'Faridpur', 'Dhaka', 'Chattogram')"
                },
                "upazila": {
                    "type": "string",
                    "description": "Thana or Upazila name in English (e.g. 'Bhanga', 'Mirpur', 'Dhanmondi')"
                },
                "address": {
                    "type": "string",
                    "description": "Full Bengali or English address including village, road, or landmarks"
                },
                "sub_area_hint": {
                    "type": "string",
                    "description": "Specific union, bazar, or landmark extracted by AI if identified in context"
                }
            },
            "required": ["district", "upazila", "address"]
        }
    }


def get_active_courier_for_merchant(merchant) -> str:
    """
    Determine the primary active courier provider for the merchant ('pathao' or 'steadfast').
    Respects profile default if configured.
    """
    if not merchant:
        return 'steadfast'

    profile = getattr(merchant, 'profile', None)
    pref = (getattr(profile, 'default_courier_provider', 'steadfast') or 'steadfast').strip().lower()

    pathao_active = PathaoCourierConfig.objects.filter(user=merchant, is_active=True).exists()
    steadfast_active = SteadFastCourierConfig.objects.filter(user=merchant, is_active=True).exists()

    if pref == 'pathao' and pathao_active:
        return 'pathao'
    if pref == 'steadfast' and steadfast_active:
        return 'steadfast'

    if steadfast_active:
        return 'steadfast'
    if pathao_active:
        return 'pathao'

    return 'steadfast'


def validate_and_suggest_courier_area(
    merchant,
    district: Optional[str] = None,
    upazila: Optional[str] = None,
    full_address: Optional[str] = None,
    sub_area_hint: Optional[str] = None,
    provider: Optional[str] = None,
    address_fail_count: int = 0,
    user_memory=None,
) -> Dict[str, Any]:
    """
    Validates the customer address against the merchant's courier provider.
    
    Zero Naive Backend Splitting:
    - Anchors strictly to district and upazila/zone.
    - If exact area is not in courier coverage, returns verified hubs within the zone
      so the customer or AI selects the nearest genuine hub.
    
    Returns:
        {
            "status": "valid" | "needs_clarification" | "unsupported",
            "provider": "pathao" | "steadfast",
            "location_ids": {
                "city_id": str | int | None,
                "zone_id": str | int | None,
                "area_id": str | int | None
            },
            "matched_names": {
                "city": str | None,
                "zone": str | None,
                "area": str | None
            },
            "suggested_areas": List[Dict[str, Any]],  # Structured objects with index, name, and IDs
            "message": str
        }
    """
    active_provider = provider or get_active_courier_for_merchant(merchant)
    district_clean = str(district or "").strip()
    upazila_clean = str(upazila or "").strip()
    full_addr_clean = str(full_address or "").strip()
    hint_clean = str(sub_area_hint or "").strip()

    # Fallback to user_memory if empty args were passed
    if not district_clean and not upazila_clean and not full_addr_clean and user_memory:
        mem_data = getattr(user_memory, 'data', {}) or {}
        order_slots = mem_data.get('order_data', {}) if isinstance(mem_data.get('order_data'), dict) else {}
        if not district_clean:
            district_clean = str(order_slots.get('district') or mem_data.get('district') or "").strip()
        if not upazila_clean:
            upazila_clean = str(order_slots.get('upazila') or mem_data.get('upazila') or "").strip()
        if not full_addr_clean:
            full_addr_clean = str(order_slots.get('address') or mem_data.get('address') or "").strip()

    result = {
        "status": "needs_clarification",
        "provider": active_provider,
        "location_ids": {"city_id": None, "zone_id": None, "area_id": None},
        "matched_names": {"city": None, "zone": None, "area": None},
        "suggested_areas": [],
        "message": ""
    }

    if not district_clean and not upazila_clean and not full_addr_clean:
        result["message"] = "ঠিকানা প্রদান করা হয়নি।"
        return result

    # 1. High-speed cache matcher
    try:
        redis_match = match_address_redis(district_clean, upazila_clean, full_addr_clean)
        prov_match = redis_match.get(active_provider) or {}
    except Exception as e:
        logger.warning(f"Error matching address via Redis: {e}")
        prov_match = {}

    if active_provider == 'pathao':
        return _validate_pathao(district_clean, upazila_clean, full_addr_clean, hint_clean, prov_match, result, address_fail_count)
    else:
        return _validate_steadfast(district_clean, upazila_clean, full_addr_clean, hint_clean, prov_match, result, address_fail_count)


def _validate_pathao(
    district: str,
    upazila: str,
    full_address: str,
    sub_area_hint: str,
    prov_match: dict,
    result: dict,
    address_fail_count: int = 0
) -> dict:
    city_id = prov_match.get('city_id')
    zone_id = prov_match.get('zone_id')
    area_id = prov_match.get('area_id')

    # If city not resolved by Redis, query database
    if not city_id and district:
        city_obj = PathaoCity.objects.filter(city_name__icontains=district).first()
        if city_obj:
            city_id = city_obj.city_id
            result["matched_names"]["city"] = city_obj.city_name

    if city_id and not result["matched_names"]["city"]:
        city_obj = PathaoCity.objects.filter(city_id=city_id).first()
        if city_obj:
            result["matched_names"]["city"] = city_obj.city_name

    # If zone not resolved, query database by upazila under city
    if city_id and not zone_id and upazila:
        zone_obj = PathaoZone.objects.filter(city_id=city_id, zone_name__icontains=upazila).first()
        if zone_obj:
            zone_id = zone_obj.zone_id
            result["matched_names"]["zone"] = zone_obj.zone_name

    if zone_id and not result["matched_names"]["zone"]:
        zone_obj = PathaoZone.objects.filter(zone_id=zone_id).first()
        if zone_obj:
            result["matched_names"]["zone"] = zone_obj.zone_name

    result["location_ids"]["city_id"] = city_id
    result["location_ids"]["zone_id"] = zone_id

    # If city not found at all
    if not city_id:
        result["status"] = "unsupported"
        result["message"] = f"জেলা '{district}' পাঠাও কুরিয়ার সার্ভিসের আওতায় পাওয়া যায়নি।"
        return result

    # If zone not found under this city, suggest available zones for customer/AI clarification
    if not zone_id:
        avail_zones = list(PathaoZone.objects.filter(city_id=city_id).values_list('zone_name', flat=True)[:8])
        structured = []
        for idx, z_name in enumerate(avail_zones, 1):
            z_obj = PathaoZone.objects.filter(city_id=city_id, zone_name=z_name).first()
            structured.append({
                "index": idx,
                "name": z_name,
                "city_id": city_id,
                "zone_id": z_obj.zone_id if z_obj else None,
                "area_id": None
            })
        result["status"] = "needs_clarification"
        result["suggested_areas"] = structured
        result["message"] = f"আপনার জেলা '{result['matched_names']['city']}' নিশ্চিত হয়েছে। অনুগ্রহ করে থানা বা জোন নির্বাচন করুন।"
        return result

    # Validate Area strictly anchored under this Zone
    if not area_id and (sub_area_hint or full_address):
        area_objs = list(PathaoArea.objects.filter(zone_id=zone_id))
        
        # 1. Match sub_area_hint provided by AI
        if sub_area_hint:
            hint_l = sub_area_hint.lower()
            for a in area_objs:
                if a.area_name.lower() in hint_l or hint_l in a.area_name.lower():
                    area_id = a.area_id
                    result["matched_names"]["area"] = a.area_name
                    break

        # 2. Check if full_address text contains full official area name under this zone
        if not area_id and full_address:
            full_addr_lower = full_address.lower()
            for a in area_objs:
                if a.area_name.lower() in full_addr_lower:
                    area_id = a.area_id
                    result["matched_names"]["area"] = a.area_name
                    break

    if area_id:
        result["location_ids"]["area_id"] = area_id
        if not result["matched_names"]["area"]:
            a_obj = PathaoArea.objects.filter(area_id=area_id).first()
            if a_obj:
                result["matched_names"]["area"] = a_obj.area_name
        result["status"] = "valid"
        result["message"] = "কুরিয়ার এরিয়া সম্পূর্ণ ভ্যালিড। এখন order_intent='create' রেখে কাস্টমারকে অর্ডারের খসড়া (Draft) দেখিয়ে 'হ্যাঁ' লিখে কনফার্ম করতে বলুন (কখনোই এই টার্নে order_intent='confirm' দিবেন না)।"
        return result

    # Infinite loop guard: If customer has already clarified >= 2 times, fallback to first zone hub
    if address_fail_count >= 2:
        first_area = PathaoArea.objects.filter(zone_id=zone_id).first()
        if first_area:
            result["location_ids"]["area_id"] = first_area.area_id
            result["matched_names"]["area"] = first_area.area_name
            result["status"] = "valid"
            result["message"] = f"ঠিকানা গ্রহণ করা হয়েছে। থানা হাব: {first_area.area_name}"
            return result

    # Fetch genuine hubs/sub-areas belonging strictly to this zone
    zone_areas = list(PathaoArea.objects.filter(zone_id=zone_id)[:8])
    structured_suggestions = []
    for idx, a in enumerate(zone_areas, 1):
        structured_suggestions.append({
            "index": idx,
            "name": a.area_name,
            "city_id": city_id,
            "zone_id": zone_id,
            "area_id": a.area_id
        })

    result["status"] = "needs_clarification"
    result["suggested_areas"] = structured_suggestions
    result["message"] = f"আপনার থানা/জোন '{result['matched_names']['zone']}' পাওয়া গেছে। আপনার এরিয়া/মহল্লা কোনটি?"
    return result


def _validate_steadfast(
    district: str,
    upazila: str,
    full_address: str,
    sub_area_hint: str,
    prov_match: dict,
    result: dict,
    address_fail_count: int = 0
) -> dict:
    city_id = prov_match.get('city_id')
    area_id = prov_match.get('area_id')

    # Steadfast levels: City (District) -> Area (Thana / Sub-area)
    if not city_id and district:
        city_obj = SteadFastCity.objects.filter(city_name__icontains=district).first()
        if city_obj:
            city_id = city_obj.city_id
            result["matched_names"]["city"] = city_obj.city_name

    if city_id and not result["matched_names"]["city"]:
        city_obj = SteadFastCity.objects.filter(city_id=city_id).first()
        if city_obj:
            result["matched_names"]["city"] = city_obj.city_name

    result["location_ids"]["city_id"] = city_id

    if not city_id:
        result["status"] = "unsupported"
        result["message"] = f"জেলা '{district}' স্টিডফাস্ট কুরিয়ারের তালিকায় পাওয়া যায়নি।"
        return result

    # Check Area (Thana or Sub-area) strictly under this City
    if not area_id:
        if upazila:
            a_obj = SteadFastArea.objects.filter(city_id=city_id, area_name__icontains=upazila).first()
            if a_obj:
                area_id = a_obj.area_id
                result["matched_names"]["area"] = a_obj.area_name

        if not area_id and sub_area_hint:
            a_obj = SteadFastArea.objects.filter(city_id=city_id, area_name__icontains=sub_area_hint).first()
            if a_obj:
                area_id = a_obj.area_id
                result["matched_names"]["area"] = a_obj.area_name

    if area_id:
        result["location_ids"]["area_id"] = area_id
        if not result["matched_names"]["area"]:
            a_obj = SteadFastArea.objects.filter(area_id=area_id).first()
            if a_obj:
                result["matched_names"]["area"] = a_obj.area_name
        result["status"] = "valid"
        result["message"] = "কুরিয়ার এরিয়া সম্পূর্ণ ভ্যালিড। এখন order_intent='create' রেখে কাস্টমারকে অর্ডারের খসড়া (Draft) দেখিয়ে 'হ্যাঁ' লিখে কনফার্ম করতে বলুন (কখনোই এই টার্নে order_intent='confirm' দিবেন না)।"
        return result

    # Steadfast allows parcel booking with district/city and free-text address without mandatory area_id.
    # If customer has provided upazila or clarified address (fail count >= 1), treat as valid!
    if upazila or address_fail_count >= 1:
        result["status"] = "valid"
        result["message"] = f"জেলা '{result['matched_names']['city']}' নিশ্চিত হয়েছে। পূর্ণ ঠিকানা স্টিডফাস্ট কুরিয়ারে বুকিং করা যাবে।"
        return result

    # Area not yet matched: fetch areas/thanas strictly under this district
    district_areas = list(SteadFastArea.objects.filter(city_id=city_id)[:8])
    structured_suggestions = []
    for idx, a in enumerate(district_areas, 1):
        structured_suggestions.append({
            "index": idx,
            "name": a.area_name,
            "city_id": city_id,
            "zone_id": None,
            "area_id": a.area_id
        })

    result["status"] = "needs_clarification"
    result["suggested_areas"] = structured_suggestions
    result["message"] = f"আপনার জেলা '{result['matched_names']['city']}' নিশ্চিত হয়েছে। আপনার থানা/এরিয়া কোনটি?"
    return result
