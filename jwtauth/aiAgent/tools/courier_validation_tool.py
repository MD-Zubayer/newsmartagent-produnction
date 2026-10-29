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
                }
            },
            "required": ["district"]
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
    provider: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Validates the customer address against the merchant's courier provider.
    
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
            "suggested_areas": List[str],  # Areas to present to user if exact area not matched
            "message": str
        }
    """
    active_provider = provider or get_active_courier_for_merchant(merchant)
    district_clean = str(district or "").strip()
    upazila_clean = str(upazila or "").strip()
    full_addr_clean = str(full_address or "").strip()

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

    # 1. First run Redis high-speed cache matcher
    try:
        redis_match = match_address_redis(district_clean, upazila_clean, full_addr_clean)
        prov_match = redis_match.get(active_provider) or {}
    except Exception as e:
        logger.warning(f"Error matching address via Redis: {e}")
        prov_match = {}

    if active_provider == 'pathao':
        return _validate_pathao(district_clean, upazila_clean, full_addr_clean, prov_match, result)
    else:
        return _validate_steadfast(district_clean, upazila_clean, full_addr_clean, prov_match, result)


def _validate_pathao(district: str, upazila: str, full_address: str, prov_match: dict, result: dict) -> dict:
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

    # If city or zone not found at all
    if not city_id:
        result["status"] = "unsupported"
        result["message"] = f"জেলা '{district}' পাঠাও কুরিয়ার সার্ভিসের আওতায় পাওয়া যায়নি।"
        return result

    if not zone_id:
        # Suggest available zones under this city
        avail_zones = list(PathaoZone.objects.filter(city_id=city_id).values_list('zone_name', flat=True)[:8])
        result["status"] = "needs_clarification"
        result["suggested_areas"] = avail_zones
        result["message"] = f"আপনার জেলা '{result['matched_names']['city']}' নিশ্চিত হয়েছে। অনুগ্রহ করে থানা বা জোন নির্বাচন করুন।"
        return result

    # Validate Area under Zone
    if not area_id and full_address:
        # Check if full_address text contains any area name under this zone
        area_objs = list(PathaoArea.objects.filter(zone_id=zone_id))
        for a in area_objs:
            if a.area_name.lower() in full_address.lower():
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
        result["message"] = "পাঠাও কুরিয়ার এরিয়া সম্পূর্ণ ভ্যালিড।"
        return result

    # Area not yet matched: fetch all sub-areas under this zone to suggest
    suggested_areas = list(PathaoArea.objects.filter(zone_id=zone_id).values_list('area_name', flat=True)[:10])
    result["status"] = "needs_clarification"
    result["suggested_areas"] = suggested_areas
    result["message"] = f"আপনার থানা/জোন '{result['matched_names']['zone']}' পাওয়া গেছে। আপনার এরিয়া/মহল্লা কোনটি?"
    return result


def _validate_steadfast(district: str, upazila: str, full_address: str, prov_match: dict, result: dict) -> dict:
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

    # Check Area (Thana or Sub-area) under this City
    if not area_id:
        search_terms = []
        if upazila:
            search_terms.append(upazila)
        if full_address:
            # Add segments from address
            for part in full_address.replace(',', ' ').split():
                if len(part) >= 3:
                    search_terms.append(part)

        for term in search_terms:
            a_obj = SteadFastArea.objects.filter(city_id=city_id, area_name__icontains=term).first()
            if a_obj:
                area_id = a_obj.area_id
                result["matched_names"]["area"] = a_obj.area_name
                break

    if area_id:
        result["location_ids"]["area_id"] = area_id
        if not result["matched_names"]["area"]:
            a_obj = SteadFastArea.objects.filter(area_id=area_id).first()
            if a_obj:
                result["matched_names"]["area"] = a_obj.area_name
        result["status"] = "valid"
        result["message"] = "স্টিডফাস্ট কুরিয়ার এরিয়া সম্পূর্ণ ভ্যালিড।"
        return result

    # Area not yet matched: fetch areas/thanas under this district
    suggested_areas = list(SteadFastArea.objects.filter(city_id=city_id).values_list('area_name', flat=True)[:10])
    result["status"] = "needs_clarification"
    result["suggested_areas"] = suggested_areas
    result["message"] = f"আপনার জেলা '{result['matched_names']['city']}' নিশ্চিত হয়েছে। আপনার থানা/এরিয়া কোনটি?"
    return result

