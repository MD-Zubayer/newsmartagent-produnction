import json
import re
from aiAgent.cache.client import get_redis_client
from courier.models import PathaoCity, PathaoZone, PathaoArea, SteadFastCity, SteadFastArea

def get_redis_conn():
    # Return redis client with db=1 to keep courier cache separate if needed, or db=0
    return get_redis_client(db=0)

def populate_courier_redis_cache():
    """
    Populate courier cities, zones, and areas from Django database models into Redis Hashes and ZSETs.
    """
    r = get_redis_conn()
    pipe = r.pipeline()

    # Clear old keys
    old_keys = r.keys("pathao:*") + r.keys("steadfast:*")
    if old_keys:
        r.delete(*old_keys)

    # --- 1. PATHAO ---
    # Cities
    cities = PathaoCity.objects.all()
    for c in cities:
        city_id = str(c.city_id)
        name_lower = c.city_name.lower().strip()
        pipe.hset("pathao:cities", city_id, c.city_name)
        # ZSET autocomplete member
        pipe.zadd("pathao:cities:ac", {f"{name_lower}:{city_id}": 0})

    # Zones
    zones = PathaoZone.objects.all()
    for z in zones:
        zone_id = str(z.zone_id)
        name_lower = z.zone_name.lower().strip()
        pipe.hset("pathao:zones", zone_id, json.dumps({
            "name": z.zone_name,
            "city_id": z.city_id
        }))
        pipe.zadd("pathao:zones:ac", {f"{name_lower}:{zone_id}:{z.city_id}": 0})

    # Areas
    areas = PathaoArea.objects.all()
    for a in areas:
        area_id = str(a.area_id)
        name_lower = a.area_name.lower().strip()
        pipe.hset("pathao:areas", area_id, json.dumps({
            "name": a.area_name,
            "zone_id": a.zone_id
        }))
        pipe.zadd("pathao:areas:ac", {f"{name_lower}:{area_id}:{a.zone_id}": 0})

    # --- 2. STEADFAST ---
    # Cities
    sf_cities = SteadFastCity.objects.all()
    for c in sf_cities:
        city_id = str(c.city_id)
        name_lower = c.city_name.lower().strip()
        pipe.hset("steadfast:cities", city_id, c.city_name)
        pipe.zadd("steadfast:cities:ac", {f"{name_lower}:{city_id}": 0})

    # Areas
    sf_areas = SteadFastArea.objects.all()
    for a in sf_areas:
        area_id = str(a.area_id)
        name_lower = a.area_name.lower().strip()
        pipe.hset("steadfast:areas", area_id, json.dumps({
            "name": a.area_name,
            "city_id": a.city_id
        }))
        pipe.zadd("steadfast:areas:ac", {f"{name_lower}:{area_id}:{a.city_id}": 0})

    pipe.execute()
    return True


def query_autocomplete_zset(zset_key, prefix):
    """
    Perform prefix range scan using ZRANGEBYLEX on sorted set.
    """
    r = get_redis_conn()
    prefix_norm = prefix.lower().strip()
    if not prefix_norm:
        return []

    # ZRANGEBYLEX key [prefix [prefix\xff
    start = f"[{prefix_norm}"
    end = f"[{prefix_norm}\xff"
    
    # decode_responses is False by connection pool setting, so decode explicitly
    results = r.zrangebylex(zset_key, start, end)
    return [res.decode('utf-8') for res in results]


def match_address_redis(district, upazila, full_address=None):
    """
    Matches the district and upazila against cached cities, zones, and areas in Redis.
    Uses full_address text to scan for specific sub-areas when available.
    Returns suggested IDs for Pathao and Steadfast.
    """
    district_clean = str(district or "").lower().strip()
    upazila_clean = str(upazila or "").lower().strip()

    suggestions = {
        "pathao": {"city_id": None, "zone_id": None, "area_id": None},
        "steadfast": {"city_id": None, "area_id": None}
    }

    if not district_clean:
        return suggestions

    r = get_redis_conn()

    # Helper: exact or contains search over Hash values if ZSET autocomplete yields no results
    def find_city_in_hash(hash_key, search_text):
        h_data = r.hgetall(hash_key)
        for cid, cname_bytes in h_data.items():
            cname = cname_bytes.decode('utf-8').lower()
            if search_text in cname or cname in search_text:
                return cid.decode('utf-8')
        return None

    # --- 1. PATHAO MATCHING ---
    # Find Pathao City
    pathao_city_id = None
    city_matches = query_autocomplete_zset("pathao:cities:ac", district_clean)
    if city_matches:
        pathao_city_id = city_matches[0].split(":")[-1]
    else:
        pathao_city_id = find_city_in_hash("pathao:cities", district_clean)

    if pathao_city_id:
        suggestions["pathao"]["city_id"] = pathao_city_id
        
        # Find Pathao Zone (filtering by city_id)
        pathao_zone_id = None
        if upazila_clean:
            zone_matches = query_autocomplete_zset("pathao:zones:ac", upazila_clean)
            for zm in zone_matches:
                parts = zm.split(":")
                if len(parts) >= 3 and parts[-1] == pathao_city_id:
                    pathao_zone_id = parts[-2]
                    break
            
            if not pathao_zone_id:
                zones_data = r.hgetall("pathao:zones")
                for zid, zval in zones_data.items():
                    val = json.loads(zval.decode('utf-8'))
                    zname = val.get("name", "").lower()
                    if str(val.get("city_id")) == pathao_city_id:
                        if upazila_clean in zname or zname in upazila_clean:
                            pathao_zone_id = zid.decode('utf-8')
                            break

        if pathao_zone_id:
            suggestions["pathao"]["zone_id"] = pathao_zone_id
            
            # Find Pathao Area (filtering by zone_id)
            pathao_area_id = None
            areas_data = r.hgetall("pathao:areas")
            
            # A. First try to match full_address text with any area in this zone
            if full_address:
                full_addr_lower = str(full_address).lower()
                for aid, aval in areas_data.items():
                    val = json.loads(aval.decode('utf-8'))
                    if str(val.get("zone_id")) == pathao_zone_id:
                        aname = val.get("name", "").lower()
                        if len(aname) >= 3 and aname in full_addr_lower:
                            pathao_area_id = aid.decode('utf-8')
                            break
            
            # B. Fallback to upazila name matches
            if not pathao_area_id and upazila_clean:
                area_matches = query_autocomplete_zset("pathao:areas:ac", upazila_clean)
                for am in area_matches:
                    parts = am.split(":")
                    if len(parts) >= 3 and parts[-1] == pathao_zone_id:
                        pathao_area_id = parts[-2]
                        break
                
                if not pathao_area_id:
                    for aid, aval in areas_data.items():
                        val = json.loads(aval.decode('utf-8'))
                        aname = val.get("name", "").lower()
                        if str(val.get("zone_id")) == pathao_zone_id:
                            if upazila_clean in aname or aname in upazila_clean:
                                pathao_area_id = aid.decode('utf-8')
                                break

            suggestions["pathao"]["area_id"] = pathao_area_id

    # --- 2. STEADFAST MATCHING ---
    # Find Steadfast City
    sf_city_id = None
    sf_city_matches = query_autocomplete_zset("steadfast:cities:ac", district_clean)
    if sf_city_matches:
        sf_city_id = sf_city_matches[0].split(":")[-1]
    else:
        sf_city_id = find_city_in_hash("steadfast:cities", district_clean)

    if sf_city_id:
        suggestions["steadfast"]["city_id"] = sf_city_id
        
        # Find Steadfast Area (filtering by city_id)
        sf_area_id = None
        sf_areas_data = r.hgetall("steadfast:areas")
        
        # A. First try to match full_address text with any area in this city
        if full_address:
            full_addr_lower = str(full_address).lower()
            for aid, aval in sf_areas_data.items():
                val = json.loads(aval.decode('utf-8'))
                if str(val.get("city_id")) == sf_city_id:
                    aname = val.get("name", "").lower()
                    if len(aname) >= 3 and aname in full_addr_lower:
                        sf_area_id = aid.decode('utf-8')
                        break
                        
        # B. Fallback to upazila name matches
        if not sf_area_id and upazila_clean:
            sf_area_matches = query_autocomplete_zset("steadfast:areas:ac", upazila_clean)
            for am in sf_area_matches:
                parts = am.split(":")
                if len(parts) >= 3 and parts[-1] == sf_city_id:
                    sf_area_id = parts[-2]
                    break
            
            if not sf_area_id:
                for aid, aval in sf_areas_data.items():
                    val = json.loads(aval.decode('utf-8'))
                    aname = val.get("name", "").lower()
                    if str(val.get("city_id")) == sf_city_id:
                        if upazila_clean in aname or aname in upazila_clean:
                            sf_area_id = aid.decode('utf-8')
                            break

        suggestions["steadfast"]["area_id"] = sf_area_id

    return suggestions


def extract_location_via_ai(address_text):
    """
    Call Gemini LLM directly to extract/infer district and upazila from address string.
    """
    if not address_text:
        return None, None
    
    try:
        from django.conf import settings
        from google import genai
        from google.genai import types
        import json
        import re
        
        # Only call if api key is configured
        if not getattr(settings, 'GEMINI_API_KEY', None):
            return None, None
            
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        prompt = (
            "You are a geography assistant for Bangladesh. "
            "Given an address, identify the district (city) name and upazila (thana) name in English. "
            "Return ONLY a JSON object with keys 'district' and 'upazila'. "
            "Example: for 'sadarpur, faridpur' or 'faridpur sadarpur' or 'sadarpur upazila, faridpur district', return:\n"
            "{\"district\": \"Faridpur\", \"upazila\": \"Sadarpur\"}\n"
            "If you cannot determine them, return null values."
        )
        
        response = client.models.generate_content(
            model='gemini-3.1-flash-lite',
            contents=[types.Content(role='user', parts=[types.Part.from_text(text=address_text)])],
            config=types.GenerateContentConfig(system_instruction=prompt)
        )
        reply = response.text.strip() if response.text else ""
        json_match = re.search(r'\{[^{}]*\}', reply)
        if json_match:
            data = json.loads(json_match.group())
            return data.get('district'), data.get('upazila')
    except Exception as e:
        # Silently fail and fallback to heuristics
        pass
        
    return None, None


def extract_location_from_address(address_text):
    """
    Splits address by punctuation and space, then resolves which part matches a courier city (district)
    and which part is the upazila. Tries AI extraction first, then falls back to heuristics.
    """
    if not address_text:
        return None, None

    # 1. Try AI-based geographic extraction first
    district_ai, upazila_ai = extract_location_via_ai(address_text)
    if district_ai:
        return district_ai, upazila_ai

    # 2. Heuristics fallback
    parts = [p.strip().lower() for p in re.split(r"[,.\s]+", address_text) if p.strip()]
    if not parts:
        return None, None

    r = get_redis_conn()
    district = None
    upazila = None

    # Check exact match on pathao or steadfast cities
    for part in parts:
        city_name = r.hget("pathao:cities", part) or r.hget("steadfast:cities", part)
        if city_name:
            district = part
            break

    # Check contains match on cities if no exact match found
    if not district:
        pathao_cities = r.hgetall("pathao:cities")
        for cid, name_bytes in pathao_cities.items():
            name = name_bytes.decode("utf-8").lower()
            for part in parts:
                if part in name or name in part:
                    district = name
                    break
            if district:
                break

    # Now identify upazila from other parts
    for part in parts:
        if part == district:
            continue
        if len(part) >= 3:
            upazila = part
            break

    # Fallbacks if one is missing
    if district and not upazila:
        for part in parts:
            if part != district:
                upazila = part
                break
    if not district and not upazila:
        if len(parts) >= 2:
            upazila = parts[0]
            district = parts[1]
        elif len(parts) == 1:
            upazila = parts[0]

    return district, upazila

