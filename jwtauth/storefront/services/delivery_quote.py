import logging
from decimal import Decimal
from courier.models import PathaoZonePrice, SteadFastAreaPrice, PathaoCourierConfig
from courier.models import (
    PathaoZonePrice,
    SteadFastAreaPrice,
    PathaoCourierConfig,
    SteadFastCourierConfig,
    SteadFastCity,
)
from courier.views import PathaoCourierClient
from courier.scrapers.steadfast_price import fetch_steadfast_live_price, scrape_steadfast_price_playwright

logger = logging.getLogger(__name__)


def calculate_delivery_charge(
    merchant,
    district: str = None,
    courier_ids: dict = None,
    item_weight: float = 0.5,
    courier_provider: str = None,
    subtotal: float = None,
    items: list = None,
    coupon_code: str = None,
    **kwargs
) -> dict:
    """
    Calculates estimated delivery charge.
    1. Checks if Pathao or SteadFast pricing cache matches the zone/area.
    2. Fallbacks to standard Bangladesh regional rates:
       - Inside Dhaka: 70 BDT
       - Sub-Dhaka (Gazipur, Narayanganj, Savar, Keraniganj): 100 BDT
       - Outside Dhaka: 130 BDT
    """
    district_clean = (district or "").strip().lower()
    courier_ids = courier_ids or {}

    # Determine which courier providers to check live
    # If explicitly requested, prioritize that; otherwise check merchant config or live engines.
    providers_to_try = []
    req_provider = (courier_provider or "").strip().lower()
    profile = getattr(merchant, "profile", None) if merchant else None
    default_courier = (getattr(profile, "default_courier_provider", "steadfast") or "steadfast").strip().lower()

    if req_provider in ("pathao", "steadfast"):
        providers_to_try.append(req_provider)
    else:
        # Prioritize merchant's default courier first
        if default_courier in ("pathao", "steadfast"):
            providers_to_try.append(default_courier)
        
        if merchant:
            try:
                if PathaoCourierConfig.objects.filter(user=merchant, is_active=True).exclude(store_id='').exists():
                    if "pathao" not in providers_to_try:
                        providers_to_try.append("pathao")
                if SteadFastCourierConfig.objects.filter(user=merchant, is_active=True).exists():
                    if "steadfast" not in providers_to_try:
                        providers_to_try.append("steadfast")
            except Exception as e:
                logger.debug(f"Error checking merchant courier config: {e}")

        # Fallback engines
        if "pathao" not in providers_to_try:
            providers_to_try.append("pathao")
        if "steadfast" not in providers_to_try:
            providers_to_try.append("steadfast")

    # Helper to apply per-provider COD policy before returning quote
    def _apply_cod_policy(quote_dict: dict, provider_code: str) -> dict:
        base_delivery = Decimal(str(quote_dict.get("delivery_charge", 0.0)))
        
        # Resolve config for the selected provider
        cod_mode = "seller"
        cod_pct = Decimal("1.00")
        
        if merchant:
            if provider_code == "pathao":
                p_cfg = PathaoCourierConfig.objects.filter(user=merchant, is_active=True).first()
                if p_cfg:
                    cod_mode = getattr(p_cfg, "cod_charge_mode", "seller") or "seller"
                    cod_pct = Decimal(str(getattr(p_cfg, "cod_percentage", 1.0) or 1.0))
            elif provider_code == "steadfast":
                s_cfg = SteadFastCourierConfig.objects.filter(user=merchant, is_active=True).first()
                if s_cfg:
                    cod_mode = getattr(s_cfg, "cod_charge_mode", "seller") or "seller"
                    cod_pct = Decimal(str(getattr(s_cfg, "cod_percentage", 1.0) or 1.0))

        # Calculate COD fee from subtotal (if provided)
        calculated_cod_fee = Decimal("0.00")
        sub_val = Decimal(str(subtotal or 0.0))
        if sub_val > 0 and cod_pct > 0:
            calculated_cod_fee = (sub_val * (cod_pct / Decimal("100.00"))).quantize(Decimal("1.00"))

        final_delivery_charge = base_delivery
        if cod_mode == "customer" and calculated_cod_fee > 0:
            final_delivery_charge = base_delivery + calculated_cod_fee

        quote_dict["base_delivery_charge"] = base_delivery
        quote_dict["cod_charge"] = calculated_cod_fee
        quote_dict["cod_bearer"] = cod_mode
        quote_dict["cod_percentage"] = float(cod_pct)
        quote_dict["delivery_charge"] = final_delivery_charge
        return quote_dict

    for provider in providers_to_try:
        if provider == "pathao":
            pathao_info = courier_ids.get("pathao") or {}
            zone_id = pathao_info.get("zone_id")
            city_id = pathao_info.get("city_id")

            # If city_id or zone_id not explicitly given, try resolving from district name or PathaoCity/Zone
            if not city_id and district_clean:
                from courier.models import PathaoCity, PathaoZone
                p_city = PathaoCity.objects.filter(city_name__iexact=district_clean).first()
                if not p_city:
                    p_city = PathaoCity.objects.filter(city_name__icontains=district_clean).first()
                if p_city:
                    city_id = p_city.city_id
                    if not zone_id:
                        p_zone = PathaoZone.objects.filter(city=p_city).first()
                        if p_zone:
                            zone_id = p_zone.zone_id

            if merchant and zone_id and city_id:
                config = PathaoCourierConfig.objects.filter(user=merchant, is_active=True).order_by("-updated_at").first()
                if config and config.store_id:
                    try:
                        payload = {"store_id": int(config.store_id), "item_type": 2, "delivery_type": 48, "item_weight": round(float(item_weight or 0.5), 2), "recipient_city": int(city_id), "recipient_zone": int(zone_id)}
                        live = PathaoCourierClient(config).calculate_price(payload)
                        total = live.get("final_price") or live.get("price") or live.get("total_amount")
                        if total is not None and float(total) > 0:
                            res = {
                                "delivery_charge": Decimal(str(total)),
                                "estimated_days": "১-২ দিন" if int(city_id) == 1 else "২-৩ দিন",
                                "courier_provider": "Pathao Courier (Live API)",
                                "region": "ঢাকা সিটি (Inside Dhaka)" if int(city_id) == 1 else (district or "ঢাকার বাইরে"),
                                "quote_source": "live_api"
                            }
                            return _apply_cod_policy(res, "pathao")
                    except Exception as e:
                        logger.info("Pathao live quote failed; using cache/fallback: %s", e)
            if zone_id:
                try:
                    zone_price = PathaoZonePrice.objects.filter(zone_id=zone_id).first()
                    if zone_price and zone_price.total_amount > 0:
                        res = {
                            "delivery_charge": Decimal(str(zone_price.total_amount)),
                            "estimated_days": "১-২ দিন" if int(city_id or 1) == 1 else "২-৩ দিন",
                            "courier_provider": "Pathao Courier (Cache)",
                            "region": "provider_cached",
                            "quote_source": "local_cache"
                        }
                        return _apply_cod_policy(res, "pathao")
                except Exception as e:
                    logger.debug(f"Error checking PathaoZonePrice: {e}")

        if provider == "steadfast":
            steadfast_info = courier_ids.get("steadfast") or {}
            area_id = steadfast_info.get("area_id")
            city_id = steadfast_info.get("city_id")

            # If city_id is not directly in courier_ids, resolve from district name or SteadFastCity
            if not city_id:
                from courier.models import SteadFastCity
                sub_dhaka_keywords = ['gazipur', 'narayanganj', 'savar', 'keraniganj', 'tongী', 'গাজীপুর', 'নারায়ণগঞ্জ', 'সাভার']
                if any(k in district_clean for k in sub_dhaka_keywords):
                    sub_city = SteadFastCity.objects.filter(city_id=18).first()
                    if sub_city:
                        city_id = sub_city.city_id

                if not city_id and district_clean:
                    sf_city = SteadFastCity.objects.filter(city_name__iexact=district_clean).first()
                    if not sf_city:
                        sf_city = SteadFastCity.objects.filter(city_name__icontains=district_clean).first()
                    if sf_city:
                        city_id = sf_city.city_id

            # Default to Dhaka (1) if no district specified
            if not city_id:
                city_id = 1

            # 1. Try Direct Steadfast Live Pricing Engine (Real-time live courier calculation)
            if city_id:
                try:
                    live_sf = fetch_steadfast_live_price(
                        to_city_id=int(city_id),
                        weight=float(item_weight or 0.5)
                    )
                    if live_sf and live_sf.get("charge") and float(live_sf["charge"]) > 0:
                        lane = live_sf.get("lane")
                        if lane == "inside_dhaka" or int(city_id) == 1:
                            region_name = "ঢাকা সিটি (Inside Dhaka)"
                            est_days = "১-২ দিন"
                        elif lane == "dhaka_to_sub" or int(city_id) == 18:
                            region_name = "ঢাকা উপশহর (Sub-Dhaka)"
                            est_days = "২-৩ দিন"
                        else:
                            region_name = f"{district} (ঢাকার বাইরে)" if district else "ঢাকার বাইরে (Outside Dhaka)"
                            est_days = "২-৪ দিন"

                        res = {
                            "delivery_charge": Decimal(str(live_sf["charge"])),
                            "estimated_days": est_days,
                            "courier_provider": "Steadfast Courier (Live API)",
                            "region": region_name,
                            "quote_source": "live_api"
                        }
                        return _apply_cod_policy(res, "steadfast")
                except Exception as e:
                    logger.info("Steadfast live quote direct failed; trying Playwright / cache: %s", e)

                # 2. Try Fallback Playwright Scraping
                try:
                    pw_charge = scrape_steadfast_price_playwright(
                        to_city_id=int(city_id),
                        weight=float(item_weight or 0.5)
                    )
                    if pw_charge and float(pw_charge) > 0:
                        res = {
                            "delivery_charge": pw_charge,
                            "estimated_days": "২-৪ দিন",
                            "courier_provider": "Steadfast Courier (Live)",
                            "region": "provider_playwright",
                            "quote_source": "playwright_scrape"
                        }
                        return _apply_cod_policy(res, "steadfast")
                except Exception as e:
                    logger.info("Steadfast Playwright live quote failed; falling back: %s", e)

            # 3. Try Local Area Price Cache
            if area_id:
                try:
                    area_price = SteadFastAreaPrice.objects.filter(area_id=area_id, city_id=city_id).first()
                    if area_price and area_price.total_amount > 0:
                        res = {
                            "delivery_charge": Decimal(str(area_price.total_amount)),
                            "estimated_days": "২-৪ দিন",
                            "courier_provider": "Steadfast Courier (Cache)",
                            "region": "provider_cached",
                            "quote_source": "local_cache"
                        }
                        return _apply_cod_policy(res, "steadfast")
                except Exception as e:
                    logger.debug(f"Error checking SteadFastAreaPrice: {e}")

    # Standard regional rules for Bangladesh
    sub_dhaka_keywords = ['gazipur', 'narayanganj', 'savar', 'keraniganj', 'tongী', 'গাজীপুর', 'নারায়ণগঞ্জ', 'সাভার']
    is_sub_dhaka = any(k in district_clean for k in sub_dhaka_keywords)

    if 'dhaka' in district_clean or 'ঢাকা' in district_clean:
        if is_sub_dhaka:
            fee = Decimal('100.00')
            region = "ঢাকা উপশহর"
            days = "২-৩ দিন"
        else:
            fee = Decimal('70.00')
            region = "ঢাকা সিটি"
            days = "১-২ দিন"
    elif district_clean:
        fee = Decimal('130.00')
        region = "ঢাকার বাইরে"
        days = "৩-৫ দিন"
    else:
        # Default if no address selected yet
        fee = Decimal('100.00')
        region = "স্ট্যান্ডার্ড ডেলিভারি"
        days = "২-৪ দিন"

    std_res = {
        "delivery_charge": fee,
        "estimated_days": days,
        "region": region,
        "courier_provider": "Standard Courier"
    }
    chosen_provider = providers_to_try[0] if providers_to_try else "manual"
    return _apply_cod_policy(std_res, chosen_provider)
