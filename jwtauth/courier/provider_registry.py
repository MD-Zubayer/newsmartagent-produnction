"""Provider-neutral courier location capabilities for storefront checkout.

Courier location IDs are intentionally kept provider-specific.  A Pathao
area_id must never be interpreted as a Steadfast area_id.
"""

from courier.models import (
    PathaoArea, PathaoCity, PathaoCourierConfig, PathaoZone,
    SteadFastArea, SteadFastCity, SteadFastCourierConfig,
)


PROVIDERS = {
    "pathao": {
        "label": "Pathao",
        "config": PathaoCourierConfig,
        "levels": ("city", "zone", "area"),
    },
    "steadfast": {
        "label": "Steadfast",
        "config": SteadFastCourierConfig,
        "levels": ("city", "area"),
    },
}


def active_provider_codes(merchant):
    return [code for code, spec in PROVIDERS.items()
            if spec["config"].objects.filter(user=merchant, is_active=True).exists()]


def provider_specs_for_merchant(merchant):
    profile = getattr(merchant, "profile", None) if merchant else None
    default_provider = (getattr(profile, "default_courier_provider", "steadfast") or "steadfast").strip().lower()
    
    specs = []
    for code, spec in PROVIDERS.items():
        cfg = spec["config"].objects.filter(user=merchant, is_active=True).order_by("-updated_at").first()
        if cfg:
            is_def = (code == default_provider)
            specs.append({
                "code": code,
                "label": spec["label"],
                "levels": list(spec["levels"]),
                "is_default": is_def,
                "cod_charge_mode": getattr(cfg, "cod_charge_mode", "seller"),
                "cod_percentage": float(getattr(cfg, "cod_percentage", 1.0) or 1.0),
            })
    # Sort so that the default courier appears first
    specs.sort(key=lambda s: not s["is_default"])
    return specs


def locations(provider, level, parent_id=None):
    if provider == "pathao":
        if level == "city":
            return list(PathaoCity.objects.order_by("city_name").values("city_id", "city_name"))
        if level == "zone" and parent_id:
            return list(PathaoZone.objects.filter(city__city_id=parent_id).order_by("zone_name").values("zone_id", "zone_name"))
        if level == "area" and parent_id:
            return list(PathaoArea.objects.filter(zone__zone_id=parent_id).order_by("area_name").values("area_id", "area_name"))
    elif provider == "steadfast":
        if level == "city":
            return list(SteadFastCity.objects.order_by("city_name").values("city_id", "city_name"))
        if level == "area" and parent_id:
            return list(SteadFastArea.objects.filter(city__city_id=parent_id).order_by("area_name").values("area_id", "area_name"))
    return []


def validate_selection(merchant, provider, selection):
    """Validate a provider-specific parent chain from local sync data."""
    if provider not in PROVIDERS or not isinstance(selection, dict):
        return False
    if not PROVIDERS[provider]["config"].objects.filter(user=merchant, is_active=True).exists():
        return False
    try:
        if provider == "pathao":
            city_id = selection.get("city_id")
            zone_id = selection.get("zone_id")
            area_id = selection.get("area_id")
            if not city_id or not zone_id:
                return False
            if area_id:
                return PathaoArea.objects.filter(
                    area_id=area_id,
                    zone__zone_id=zone_id,
                    zone__city__city_id=city_id,
                ).exists()
            return PathaoZone.objects.filter(
                zone_id=zone_id,
                city__city_id=city_id,
            ).exists()
        if provider == "steadfast":
            city_id = selection.get("city_id")
            area_id = selection.get("area_id")
            if not city_id:
                return False
            if area_id:
                return SteadFastArea.objects.filter(
                    area_id=area_id,
                    city__city_id=city_id,
                ).exists()
            return SteadFastCity.objects.filter(city_id=city_id).exists()
    except (TypeError, ValueError):
        return False
    return False
