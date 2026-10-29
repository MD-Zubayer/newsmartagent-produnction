import logging
import json
from courier.models import PathaoCity, PathaoZone, PathaoArea, SteadFastCity, SteadFastArea
from courier.utils.redis_courier_cache import match_address_redis, extract_location_from_address

logger = logging.getLogger(__name__)


def suggest_courier_areas(query: str, limit: int = 8) -> list:
    """
    Autocompletes districts, zones, and areas as the customer types their address.
    Returns matched locations with pre-filled district, upazila, and courier mapping.
    """
    if not query or len(query.strip()) < 2:
        return []

    q = query.strip().lower()
    results = []

    # 1. Search Pathao Areas / Zones from DB
    try:
        areas = PathaoArea.objects.filter(area_name__icontains=q).select_related('zone', 'zone__city')[:limit]
        for a in areas:
            results.append({
                "label": f"{a.area_name}, {a.zone.zone_name}, {a.zone.city.city_name}",
                "area_name": a.area_name,
                "upazila": a.zone.zone_name,
                "district": a.zone.city.city_name,
                "pathao": {
                    "city_id": a.zone.city.city_id,
                    "zone_id": a.zone.zone_id,
                    "area_id": a.area_id,
                }
            })
    except Exception as e:
        logger.warning(f"Error querying PathaoArea: {e}")

    # If results are still fewer than limit, search Pathao Zones
    if len(results) < limit:
        try:
            zones = PathaoZone.objects.filter(zone_name__icontains=q).select_related('city')[:(limit - len(results))]
            for z in zones:
                # Avoid duplicate labels
                lbl = f"{z.zone_name}, {z.city.city_name}"
                if not any(r['label'].startswith(z.zone_name) for r in results):
                    results.append({
                        "label": lbl,
                        "area_name": "",
                        "upazila": z.zone_name,
                        "district": z.city.city_name,
                        "pathao": {
                            "city_id": z.city.city_id,
                            "zone_id": z.zone_id,
                            "area_id": None,
                        }
                    })
        except Exception as e:
            logger.warning(f"Error querying PathaoZone: {e}")

    # If still fewer, search Steadfast Areas
    if len(results) < limit:
        try:
            sf_areas = SteadFastArea.objects.filter(area_name__icontains=q).select_related('city')[:(limit - len(results))]
            for sfa in sf_areas:
                lbl = f"{sfa.area_name}, {sfa.city.city_name}"
                if not any(r['label'] == lbl for r in results):
                    results.append({
                        "label": lbl,
                        "area_name": sfa.area_name,
                        "upazila": sfa.area_name,
                        "district": sfa.city.city_name,
                        "steadfast": {
                            "city_id": sfa.city.city_id,
                            "area_id": sfa.area_id
                        }
                    })
        except Exception as e:
            logger.warning(f"Error querying SteadFastArea: {e}")

    return results


BANGLA_DISTRICT_TO_STEADFAST = {
    'ঢাকা': (1, 'Dhaka City'),
    'dhaka': (1, 'Dhaka City'),
    'চট্টগ্রাম': (2, 'Chittagong'),
    'চিটাগাং': (2, 'Chittagong'),
    'চিটাগং': (2, 'Chittagong'),
    'chittagong': (2, 'Chittagong'),
    'chattogram': (2, 'Chittagong'),
    'সিলেট': (3, 'Sylhet'),
    'sylhet': (3, 'Sylhet'),
    'রংপুর': (4, 'Rangpur'),
    'rangpur': (4, 'Rangpur'),
    'রাজশাহী': (5, 'Rajshahi'),
    'rajshahi': (5, 'Rajshahi'),
    'খুলনা': (6, 'Khulna'),
    'khulna': (6, 'Khulna'),
    'বরিশাল': (7, 'Barishal'),
    'barishal': (7, 'Barishal'),
    'নোয়াখালী': (8, 'Noakhali'),
    'নোয়াখালী': (8, 'Noakhali'),
    'noakhali': (8, 'Noakhali'),
    'ময়মনসিংহ': (10, 'Mymensingh'),
    'ময়মনসিংহ': (10, 'Mymensingh'),
    'mymensingh': (10, 'Mymensingh'),
    'কুমিল্লা': (15, 'Comilla'),
    'comilla': (15, 'Comilla'),
    'গাজীপুর': (18, 'Dhaka Sub-Urban'),
    'gazipur': (18, 'Dhaka Sub-Urban'),
    'নারায়ণগঞ্জ': (18, 'Dhaka Sub-Urban'),
    'নারায়নগঞ্জ': (18, 'Dhaka Sub-Urban'),
    'narayanganj': (18, 'Dhaka Sub-Urban'),
    'সাভার': (18, 'Dhaka Sub-Urban'),
    'savar': (18, 'Dhaka Sub-Urban'),
    'কেরানীগঞ্জ': (18, 'Dhaka Sub-Urban'),
    'কেরানিগঞ্জ': (18, 'Dhaka Sub-Urban'),
    'keraniganj': (18, 'Dhaka Sub-Urban'),
    'টঙ্গী': (18, 'Dhaka Sub-Urban'),
    'tongi': (18, 'Dhaka Sub-Urban'),
    'ধানমন্ডি': (1, 'Dhaka City'),
    'মিরপুর': (1, 'Dhaka City'),
    'উত্তরা': (1, 'Dhaka City'),
    'গুলশান': (1, 'Dhaka City'),
    'বনানী': (1, 'Dhaka City'),
    'মোহাম্মদপুর': (1, 'Dhaka City'),
    'বাড্ডা': (1, 'Dhaka City'),
    'যাত্রাবাড়ী': (1, 'Dhaka City'),
    'যাত্রাবাড়ি': (1, 'Dhaka City'),
    'মতিঝিল': (1, 'Dhaka City'),
}


def resolve_courier_mapping_for_address(full_address: str, district: str = None, upazila: str = None) -> dict:
    """
    Takes an address string, extracts district and upazila if not provided,
    and returns matched courier IDs for Pathao and Steadfast.
    """
    import re
    d = district
    u = upazila

    # Check direct dictionary mapping on keywords (handling Bengali inflection suffixes like -এ, -তে, -র, -য়)
    matched_sf_city_id = None
    matched_district_name = None
    text_lower = (full_address or "").lower()

    # 1. Direct substring check for any known district in Bangladesh
    for k, (cid, dname) in BANGLA_DISTRICT_TO_STEADFAST.items():
        if k in text_lower:
            matched_sf_city_id = cid
            matched_district_name = dname
            break

    # 2. Token-level check with Bengali inflection suffix stripping (-এ, -তে, -র, -য়)
    if not matched_sf_city_id:
        tokens = [p.strip("?,.!/ ") for p in text_lower.split() if p.strip()]
        for token in tokens:
            stem = re.sub(r'(?:[এেয়]|তে|[েএ]র)$', '', token).strip()
            for k in (token, stem):
                if k in BANGLA_DISTRICT_TO_STEADFAST:
                    matched_sf_city_id, matched_district_name = BANGLA_DISTRICT_TO_STEADFAST[k]
                    break
            if matched_sf_city_id:
                break

    if not d or not u:
        ext_d, ext_u = extract_location_from_address(full_address or "")
        d = d or ext_d or matched_district_name
        u = u or ext_u
    else:
        d = d or matched_district_name

    try:
        suggestions = match_address_redis(d, u, full_address=full_address) or {}
    except Exception as e:
        logger.warning(f"Error resolving courier mapping via redis: {e}")
        suggestions = {}

    # Guarantee Steadfast city_id if matched from dictionary
    if matched_sf_city_id:
        if not suggestions.get('steadfast'):
            suggestions['steadfast'] = {}
        suggestions['steadfast']['city_id'] = str(matched_sf_city_id)

    return {
        "district": d or matched_district_name,
        "upazila": u,
        "courier_location_ids": suggestions
    }
