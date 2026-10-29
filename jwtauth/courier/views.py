import os
import requests
import logging
import hmac
import hashlib
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from users.authentication import CookieJWTAuthentication
from django.shortcuts import get_object_or_404

from .models import PathaoCourierConfig, PathaoBookingLog, PathaoZonePrice, SteadFastBookingLog, SteadFastCourierConfig
from users.models import CustomerOrder

logger = logging.getLogger(__name__)

class PathaoCourierClient:
    def __init__(self, config):
        self.config = config
        self.base_url = "https://courier-api-sandbox.pathao.com" if config.is_sandbox else "https://api-hermes.pathao.com"

    def get_headers(self):
        token = self.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def get_access_token(self):
        # If access token is cached and not expiring within 5 minutes, use it
        if self.config.access_token and self.config.token_expires_at and self.config.token_expires_at > timezone.now() + timedelta(minutes=5):
            return self.config.access_token

        # If the config does not exist in the database yet, create it first so update_fields works later.
        if not self.config.pk:
            self.config.save()

        url = f"{self.base_url}/aladdin/api/v1/issue-token"

        # 1. Try OAuth 2.0 refresh_token grant first if refresh_token exists
        if self.config.refresh_token:
            refresh_payload = {
                "client_id": self.config.client_id,
                "client_secret": self.config.client_secret,
                "grant_type": "refresh_token",
                "refresh_token": self.config.refresh_token
            }
            try:
                ref_res = requests.post(url, json=refresh_payload, timeout=15)
                ref_data = ref_res.json() if ref_res.content else None
                if ref_res.status_code == 200 and ref_data and "access_token" in ref_data:
                    self.config.access_token = ref_data["access_token"]
                    self.config.refresh_token = ref_data.get("refresh_token", self.config.refresh_token)
                    expires_in = ref_data.get("expires_in", 432000)
                    self.config.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
                    self.config.save(update_fields=["access_token", "refresh_token", "token_expires_at"])
                    return self.config.access_token
            except Exception as ref_err:
                logger.warning(f"Pathao refresh_token grant failed, falling back to password grant: {ref_err}")

        # 2. Request a new token using password grant
        payload = {
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
            "username": self.config.username,
            "password": self.config.password,
            "grant_type": "password"
        }
        
        try:
            response = requests.post(url, json=payload, timeout=15)
            try:
                response_data = response.json()
            except ValueError:
                response_data = None
            
            if response.status_code == 200 and response_data and "access_token" in response_data:
                self.config.access_token = response_data["access_token"]
                self.config.refresh_token = response_data.get("refresh_token")
                expires_in = response_data.get("expires_in", 432000)
                self.config.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
                self.config.save(update_fields=["access_token", "refresh_token", "token_expires_at"])
                return self.config.access_token
            else:
                logger.error(f"Failed to issue Pathao token: {response.text}")
                error_msg = "Authentication with Pathao API failed."
                if response_data:
                    error_msg = response_data.get("message", error_msg)
                    if "errors" in response_data:
                        error_msg += f" {response_data['errors']}"
                else:
                    error_msg = f"Pathao API returned an invalid response (Status {response.status_code}). They might be experiencing downtime."
                raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Pathao connection error: {str(e)}")
            raise Exception(f"Unable to connect to Pathao Courier. Error: {str(e)}")

    def get_stores(self):
        url = f"{self.base_url}/aladdin/api/v1/stores"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch stores: {response.text}")

    def get_cities(self):
        url = f"{self.base_url}/aladdin/api/v1/city-list"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch cities: {response.text}")

    def get_zones(self, city_id):
        url = f"{self.base_url}/aladdin/api/v1/cities/{city_id}/zone-list"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch zones: {response.text}")

    def get_areas(self, zone_id):
        url = f"{self.base_url}/aladdin/api/v1/zones/{zone_id}/area-list"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch areas: {response.text}")

    def create_store(self, store_data):
        url = f"{self.base_url}/aladdin/api/v1/stores"
        response = requests.post(url, json=store_data, headers=self.get_headers(), timeout=15)
        try:
            response_data = response.json()
        except ValueError:
            raise Exception(f"Pathao API returned an invalid response (Status {response.status_code}).")
        if response.status_code in [200, 201]:
            return response_data
        err_msg = response_data.get("message", "Failed to create store.")
        if "errors" in response_data:
            err_msg += f" {response_data['errors']}"
        raise Exception(err_msg)

    def create_order(self, order_data):
        url = f"{self.base_url}/aladdin/api/v1/orders"
        response = requests.post(url, json=order_data, headers=self.get_headers(), timeout=15)
        response_data = response.json()
        if response.status_code in [200, 201] and response_data.get("type") == "success":
            return response_data
        
        err_msg = response_data.get("message", "Booking failed.")
        if "errors" in response_data:
            err_msg += f" {response_data['errors']}"
        raise Exception(err_msg)

    def get_order_info(self, consignment_id):
        url = f"{self.base_url}/aladdin/api/v1/orders/{consignment_id}/info"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {})
        raise Exception(f"Failed to fetch order info: {response.text}")

    def calculate_price(self, payload):
        url = f"{self.base_url}/aladdin/api/v1/merchant/price-plan"
        response = requests.post(url, json=payload, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {})
        raise Exception(f"Price calculation failed: {response.text}")


# --- STEADFAST COURIER CLIENT ---

class SteadFastCourierClient:
    def __init__(self, config):
        self.config = config
        production_url = os.getenv("STEADFAST_BASE_URL", "https://portal.packzy.com/api/v1")
        sandbox_url = os.getenv("STEADFAST_SANDBOX_BASE_URL", "https://portal.packzy.com/api/v1")
        self.base_url = sandbox_url if config.is_sandbox else production_url
        if config.is_sandbox:
            logging.getLogger(__name__).debug("Using SteadFast sandbox endpoint: %s", self.base_url)

    def get_headers(self):
        return {
            "Api-Key": self.config.api_key,
            "Secret-Key": self.config.api_secret,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

    def get_balance(self):
        url = f"{self.base_url}/get_balance"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        try:
            data = response.json()
        except ValueError:
            data = None
        if response.status_code == 200 and data and data.get("status") == 200:
            return data
        err_msg = data.get("message") if data else f"SteadFast API returned status {response.status_code}"
        raise Exception(err_msg or "Failed to verify SteadFast credentials via /get_balance.")

    def get_cities(self):
        # Using police_stations endpoint to get coverage areas
        url = f"{self.base_url}/police_stations"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                raise Exception("SteadFast returned invalid JSON for cities endpoint.")
            return data.get("data", []) if isinstance(data.get("data"), list) else []
        raise Exception(f"Failed to fetch cities: {response.text}")

    def get_areas(self, city_id):
        # Using police_stations endpoint with city_id filter
        url = f"{self.base_url}/police_stations"
        params = {"city_id": city_id}
        response = requests.get(url, params=params, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                raise Exception("SteadFast returned invalid JSON for areas endpoint.")
            return data.get("data", []) if isinstance(data.get("data"), list) else []
        raise Exception(f"Failed to fetch areas: {response.text}")

    def create_order(self, order_data):
        url = f"{self.base_url}/create_order"
        response = requests.post(url, json=order_data, headers=self.get_headers(), timeout=15)
        # Defensive JSON parsing: SteadFast sometimes returns empty/non-JSON bodies.
        try:
            response_data = response.json()
        except ValueError:
            response_data = None

        if response.status_code in [200, 201] and response_data and response_data.get("status") == 200:
            return response_data

        # Build helpful error message including raw response text when JSON unavailable
        if response_data:
            err_msg = response_data.get("message", "Booking failed.")
            if "errors" in response_data:
                err_msg += f" {response_data['errors']}"
        else:
            raw = response.text or ""
            snippet = raw[:1000] + ("..." if len(raw) > 1000 else "")
            err_msg = f"SteadFast API returned non-JSON response (status {response.status_code}): {snippet}"

        raise Exception(err_msg)

    def get_order_info(self, consignment_id):
        # Using status_by_cid endpoint according to official documentation
        url = f"{self.base_url}/status_by_cid/{consignment_id}"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            try:
                data = response.json()
            except ValueError:
                raise Exception("SteadFast returned invalid JSON for order info endpoint.")
            if isinstance(data, dict):
                inner = data.get("data") if isinstance(data.get("data"), dict) else dict(data)
                inner["delivery_status"] = data.get("delivery_status") or inner.get("delivery_status") or "unknown"
                return inner
            return {}
        raise Exception(f"Failed to fetch order info: {response.text}")

    def get_fraud_check_score(self, phone):
        """Return Steadfast's merchant-authorized phone risk aggregate."""
        digits = ''.join(ch for ch in str(phone or '') if ch.isdigit())
        if digits.startswith('880'):
            digits = '0' + digits[3:]
        if len(digits) < 10:
            raise ValueError('A valid phone number is required for Steadfast fraud check.')
        url = f"{self.base_url}/fraud_check/score/{digits}"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        try:
            data = response.json()
        except ValueError as exc:
            raise Exception('Steadfast returned invalid JSON for fraud check endpoint.') from exc
        if response.status_code != 200 or data.get('status') not in (None, 200):
            raise Exception(data.get('message') or f'Fraud check failed (status {response.status_code}).')
        return data

    def calculate_price(self, payload):
        # Note: SteadFast API documentation doesn't provide specific pricing endpoint
        # Using create_order with dry-run or similar approach if available
        # For now, returning a placeholder - this may need adjustment based on actual SteadFast pricing API
        url = f"{self.base_url}/create_order"
        try:
            # Attempt to get pricing if SteadFast has a separate endpoint
            # This is a placeholder pending official SteadFast pricing API documentation
            response = requests.post(url, json=payload, headers=self.get_headers(), timeout=15)
            if response.status_code == 200:
                try:
                    data = response.json()
                except ValueError:
                    raise Exception("SteadFast returned invalid JSON for price calculation.")
                if data.get("status") == 200:
                    return data.get("data", {})
            raise Exception(f"Price calculation error: Unable to calculate shipping cost: {response.text}")
        except Exception as e:
            raise Exception(f"Price calculation failed: {str(e)}")


# --- API VIEWS ---

def _resolve_courier_webhook_domain(request) -> str:
    """
    Dynamically resolves webhook domain:
    1. First priority: Incoming request host (e.g. dev.newsmartagent.com or newsmartagent.com).
       Filters out internal Docker service names (like backend:8000, localhost, IP addresses).
    2. Fallback: MAIN_DOMAIN from environment variables or Django settings.
    """
    try:
        host = request.get_host().split(':')[0].strip().lower()
        if host and host not in ('localhost', '127.0.0.1', 'backend', 'web', 'nginx') and not host.replace('.', '').isdigit():
            return host
    except Exception as e:
        logger.debug(f"[CourierConfig] Host detection error: {e}")

    from django.conf import settings
    return os.getenv("MAIN_DOMAIN") or getattr(settings, 'MAIN_DOMAIN', 'newsmartagent.com')


class PathaoCourierConfigView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_config(self, request, config_id=None):
        if config_id:
            return PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        return PathaoCourierConfig.objects.filter(user=request.user).first()

    def get(self, request):
        configs = PathaoCourierConfig.objects.filter(user=request.user)
        base_domain = _resolve_courier_webhook_domain(request)
        return Response([
            {
                "id": config.id,
                "name": config.name,
                "client_id": config.client_id,
                "username": config.username,
                "store_id": config.store_id,
                "webhook_secret": config.webhook_secret or "",
                "webhook_url": f"https://{base_domain}/api/courier/webhooks/pathao/{request.user.id}/",
                "is_sandbox": config.is_sandbox,
                "is_active": config.is_active,
                "cod_charge_mode": getattr(config, "cod_charge_mode", "seller"),
                "cod_percentage": float(getattr(config, "cod_percentage", 1.0) or 1.0),
            }
            for config in configs
        ])

    def post(self, request):
        config_id = request.data.get("config_id")
        client_id = request.data.get("client_id")
        client_secret = request.data.get("client_secret")
        username = request.data.get("username")
        password = request.data.get("password")
        store_id = request.data.get("store_id")
        webhook_secret = request.data.get("webhook_secret")
        name = request.data.get("name")
        is_sandbox = request.data.get("is_sandbox", True)
        is_active = request.data.get("is_active", True)
        cod_charge_mode = request.data.get("cod_charge_mode")
        cod_percentage = request.data.get("cod_percentage")

        if not all([client_id, username]):
            return Response({"error": "client_id and username are required."}, status=status.HTTP_400_BAD_REQUEST)

        if config_id:
            config = self._get_config(request, config_id)
            if not config:
                return Response({"error": "Pathao configuration not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            config = PathaoCourierConfig.objects.filter(user=request.user, client_id=str(client_id).strip()).first()
            if not config:
                config = PathaoCourierConfig.objects.filter(user=request.user).first()
            if not config:
                config = PathaoCourierConfig(user=request.user)

        config.name = name or config.name
        config.client_id = str(client_id).strip()
        if client_secret:
            config.client_secret = str(client_secret).strip()
        elif not config.pk:
            return Response({"error": "client_secret is required for new config."}, status=status.HTTP_400_BAD_REQUEST)

        config.username = str(username).strip()
        if password:
            config.password = password
        elif not config.pk:
            return Response({"error": "password is required for new config."}, status=status.HTTP_400_BAD_REQUEST)

        if store_id is not None:
            config.store_id = str(store_id).strip() if store_id else None
        if webhook_secret is not None:
            config.webhook_secret = str(webhook_secret).strip() if webhook_secret else None
        if cod_charge_mode in ('seller', 'customer'):
            config.cod_charge_mode = cod_charge_mode
        if cod_percentage is not None:
            try:
                config.cod_percentage = float(cod_percentage)
            except (ValueError, TypeError):
                pass
        config.is_sandbox = bool(is_sandbox)
        config.is_active = bool(is_active)

        # Only invalidate tokens if credentials or environment changed
        credentials_changed = bool(client_secret or password)
        if credentials_changed:
            config.access_token = None
            config.refresh_token = None
            config.token_expires_at = None

        try:
            client = PathaoCourierClient(config)
            client.get_access_token()
            config.save()

            stores = []
            try:
                stores = client.get_stores()
                if not config.store_id and stores and isinstance(stores, list) and len(stores) > 0:
                    default_st = next((s for s in stores if s.get("is_default_store")), stores[0])
                    if default_st.get("store_id"):
                        config.store_id = str(default_st["store_id"])
                        config.save(update_fields=["store_id"])
            except Exception as st_err:
                logger.warning(f"Verified Pathao token but failed to fetch stores: {st_err}")

            return Response({
                "message": "Pathao credentials verified and saved successfully!",
                "id": config.id,
                "store_id": config.store_id,
                "stores": stores
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        config_id = request.query_params.get("config_id") or request.data.get("config_id")
        config = self._get_config(request, config_id)
        if not config:
            return Response({"error": "No Pathao configuration found to delete."}, status=status.HTTP_404_NOT_FOUND)
        config.delete()
        return Response({"message": "Pathao courier configuration deleted successfully."}, status=status.HTTP_200_OK)


class PathaoStoreListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config_id = request.query_params.get("config_id")
        if config_id:
            config = PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = PathaoCourierConfig.objects.filter(user=request.user).first()

        if not config:
            return Response({"error": "Pathao configuration not set"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = PathaoCourierClient(config)
            stores = client.get_stores()
            return Response(stores)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoStoreCreateView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        config_id = request.data.get("config_id") or request.query_params.get("config_id")
        if config_id:
            config = PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "Pathao configuration not set or inactive."}, status=status.HTTP_400_BAD_REQUEST)

        name = request.data.get("name")
        contact_name = request.data.get("contact_name")
        contact_number = request.data.get("contact_number")
        address = request.data.get("address")
        city_id = request.data.get("city_id")
        zone_id = request.data.get("zone_id")
        area_id = request.data.get("area_id")

        if not all([name, contact_name, contact_number, address]):
            return Response({"error": "Store name, contact name, contact number, and address are required."}, status=status.HTTP_400_BAD_REQUEST)

        store_payload = {
            "name": str(name),
            "contact_name": str(contact_name),
            "contact_number": str(contact_number),
            "address": str(address),
        }
        if city_id:
            store_payload["city_id"] = int(city_id)
        if zone_id:
            store_payload["zone_id"] = int(zone_id)
        if area_id:
            store_payload["area_id"] = int(area_id)

        try:
            client = PathaoCourierClient(config)
            result = client.create_store(store_payload)
            new_store_id = result.get("data", {}).get("store_id") or result.get("data", {}).get("id")
            return Response({
                "message": "Store created successfully!",
                "store_id": new_store_id,
                "data": result.get("data", {})
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": f"Failed to create store: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class PathaoCityListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        from .models import PathaoCity
        cities = list(PathaoCity.objects.values("city_id", "city_name"))
        return Response(cities)


class PathaoZoneListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        city_id = request.query_params.get("city_id")
        if not city_id:
            return Response({"error": "city_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import PathaoZone
        zones = list(PathaoZone.objects.filter(city__city_id=city_id).values("zone_id", "zone_name"))
        return Response(zones)


class PathaoAreaListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        zone_id = request.query_params.get("zone_id")
        if not zone_id:
            return Response({"error": "zone_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import PathaoArea
        areas = list(PathaoArea.objects.filter(zone__zone_id=zone_id).values("area_id", "area_name"))
        return Response(areas)


class PathaoBookOrderView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("order_id")
        store_id = request.data.get("store_id")
        recipient_name = request.data.get("recipient_name")
        recipient_phone = request.data.get("recipient_phone")
        recipient_address = request.data.get("recipient_address")
        special_instruction = request.data.get("special_instruction")
        
        # ঐচ্ছিক আইডিগুলো (যদি ম্যানুয়াল ফর্ম থেকে আসে, নাল ভ্যালু ফিল্টার করার জন্য)
        recipient_city = request.data.get("recipient_city")
        recipient_zone = request.data.get("recipient_zone")
        recipient_area = request.data.get("recipient_area")
        
        item_quantity = request.data.get("item_quantity", 1)
        item_weight = request.data.get("item_weight", 0.5)
        amount_to_collect = request.data.get("amount_to_collect", 0)
        item_description = request.data.get("item_description", "Order Parcel")
        delivery_type = request.data.get("delivery_type", 48)  
        item_type = request.data.get("item_type", 2)  

        if not all([order_id, recipient_name, recipient_phone, recipient_address]):
            return Response({"error": "Required booking fields (name, phone, address) are missing."}, status=status.HTTP_400_BAD_REQUEST)

        config_id = request.data.get("config_id") or request.query_params.get("config_id")
        if config_id:
            config = PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "Pathao courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        final_store_id = store_id or config.store_id
        if not final_store_id:
            return Response({"error": "Store ID is required for courier booking."}, status=status.HTTP_400_BAD_REQUEST)

        # ব্যবহারকারীর অর্ডারটি খুঁজে বের করা
        order = get_object_or_404(CustomerOrder, id=order_id, user=request.user)

        # পেলোড তৈরি (পাঠাও ডকুমেন্টেশন অনুযায়ী নাল ভ্যালু পাঠানো যাবে না)
        pathao_payload = {
            "store_id": int(final_store_id),
            "merchant_order_id": f"ORD-{order.id}",
            "recipient_name": str(recipient_name),
            "recipient_phone": str(recipient_phone),
            "recipient_address": str(recipient_address),
            "delivery_type": int(delivery_type),
            "item_type": int(item_type),
            "item_quantity": int(item_quantity),
            "item_weight": float(item_weight),
            "amount_to_collect": int(float(amount_to_collect)), # পাঠাও ইন্টিজার প্রত্যাশা করে
            "item_description": str(item_description)
        }

        # যদি ম্যানুয়াল এন্ট্রি থেকে সিটি/জোন/এরিয়া আইডি আসে, তবেই পেলোডে যোগ হবে
        if recipient_city:
            pathao_payload["recipient_city"] = int(recipient_city)
        if recipient_zone:
            pathao_payload["recipient_zone"] = int(recipient_zone)
        if recipient_area:
            pathao_payload["recipient_area"] = int(recipient_area)
            
        if special_instruction:
            pathao_payload["special_instruction"] = str(special_instruction)

        try:
            client = PathaoCourierClient(config)
            booking_response = client.create_order(pathao_payload)

            
            consignment_id = booking_response.get("data", {}).get("consignment_id")
            consignment_status = booking_response.get("data", {}).get("order_status", "Pending") # ডক অনুযায়ী এটি 'order_status'

            # বুকিং লগ সংরক্ষণ
            PathaoBookingLog.objects.create(
                order=order,
                consignment_id=consignment_id,
                merchant_order_id=pathao_payload["merchant_order_id"],
                status=consignment_status.lower(),
                response_data=booking_response
            )

            # অর্ডার মডেল আপডেট
            order.status = "shipped"
            tracking_info = f"\nPathao Courier Tracking ID: {consignment_id}"
            if order.extra_info:
                order.extra_info += tracking_info
            else:
                order.extra_info = tracking_info.strip()
            order.save()

            return Response({
                "message": "Order successfully booked in Pathao Courier!",
                "consignment_id": consignment_id,
                "status": consignment_status
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"Pathao Booking Failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class PathaoOrderInfoView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, consignment_id):
        config_id = request.query_params.get("config_id")
        if config_id:
            config = PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "Pathao courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = PathaoCourierClient(config)
            info = client.get_order_info(consignment_id)
            return Response(info, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoPriceCalculatorView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        store_id = request.data.get("store_id")
        item_type = request.data.get("item_type")
        delivery_type = request.data.get("delivery_type")
        item_weight = request.data.get("item_weight")
        recipient_city = request.data.get("recipient_city")
        recipient_zone = request.data.get("recipient_zone")

        if not all([store_id, item_type, delivery_type, item_weight, recipient_city, recipient_zone]):
            return Response({"error": "Required fields for price calculation are missing."}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize types
        store_id_str = str(store_id)
        city_id_int = int(recipient_city)
        zone_id_int = int(recipient_zone)
        weight_float = round(float(item_weight), 2)

        # 1. Try to fetch from local database cache first (valid for 3 days)
        cache_expiry_limit = timezone.now() - timedelta(days=3)
        cached_price = PathaoZonePrice.objects.filter(
            store_id=store_id_str,
            city_id=city_id_int,
            zone_id=zone_id_int,
            weight=weight_float,
            updated_at__gte=cache_expiry_limit
        ).first()

        if cached_price:
            return Response({
                "delivery_fee": float(cached_price.delivery_fee),
                "cod_charge": float(cached_price.cod_charge),
                "discount": float(cached_price.discount),
                "total_amount": float(cached_price.total_amount)
            }, status=status.HTTP_200_OK)

        # 2. If not cached or cache is stale, perform live API call
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "Pathao courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "store_id": int(store_id),
            "item_type": int(item_type),
            "delivery_type": int(delivery_type),
            "item_weight": float(item_weight),
            "recipient_city": int(recipient_city),
            "recipient_zone": int(recipient_zone)
        }

        try:
            client = PathaoCourierClient(config)
            price_details = client.calculate_price(payload)

            # 3. Store/Update result in database cache for future requests
            PathaoZonePrice.objects.update_or_create(
                store_id=store_id_str,
                city_id=city_id_int,
                zone_id=zone_id_int,
                weight=weight_float,
                defaults={
                    "delivery_fee": price_details.get("delivery_fee", 0.0),
                    "cod_charge": price_details.get("cod_charge", 0.0),
                    "discount": price_details.get("discount", 0.0),
                    "total_amount": price_details.get("total_amount", 0.0)
                }
            )

            return Response(price_details, status=status.HTTP_200_OK)
        except Exception as e:
            # Fallback to expired cache if API is down
            fallback_price = PathaoZonePrice.objects.filter(
                store_id=store_id_str,
                city_id=city_id_int,
                zone_id=zone_id_int,
                weight=weight_float
            ).first()
            if fallback_price:
                return Response({
                    "delivery_fee": float(fallback_price.delivery_fee),
                    "cod_charge": float(fallback_price.cod_charge),
                    "discount": float(fallback_price.discount),
                    "total_amount": float(fallback_price.total_amount),
                    "is_fallback": True
                }, status=status.HTTP_200_OK)

            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


# --- STEADFAST API VIEWS ---

class SteadFastCourierConfigView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import SteadFastCourierConfig
        configs = SteadFastCourierConfig.objects.filter(user=request.user)
        base_domain = _resolve_courier_webhook_domain(request)
        return Response([
            {
                "id": config.id,
                "name": config.name,
                "api_key": config.api_key,
                "webhook_token": getattr(config, 'webhook_token', None) or "",
                "webhook_url": f"https://{base_domain}/api/courier/webhooks/steadfast/{request.user.id}/",
                "is_sandbox": config.is_sandbox,
                "is_active": config.is_active,
                "cod_charge_mode": getattr(config, "cod_charge_mode", "seller"),
                "cod_percentage": float(getattr(config, "cod_percentage", 1.0) or 1.0),
            }
            for config in configs
        ])

    def post(self, request):
        from .models import SteadFastCourierConfig
        config_id = request.data.get("config_id")
        api_key = request.data.get("api_key")
        api_secret = request.data.get("api_secret")
        webhook_token = request.data.get("webhook_token")
        name = request.data.get("name")
        is_sandbox = request.data.get("is_sandbox", True)
        is_active = request.data.get("is_active", True)
        cod_charge_mode = request.data.get("cod_charge_mode")
        cod_percentage = request.data.get("cod_percentage")

        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
            if not config:
                return Response({"error": "SteadFast configuration not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            config = SteadFastCourierConfig.objects.filter(user=request.user).first()
            if not config:
                config = SteadFastCourierConfig(user=request.user)

        # Detect credential changes
        credentials_changed = False

        if api_key:
            clean_api_key = str(api_key).strip()
            if clean_api_key != config.api_key:
                config.api_key = clean_api_key
                credentials_changed = True
        elif not config.pk or not config.api_key:
            return Response({"error": "api_key is required for new config."}, status=status.HTTP_400_BAD_REQUEST)

        if api_secret:
            clean_api_secret = str(api_secret).strip()
            if clean_api_secret != config.api_secret:
                config.api_secret = clean_api_secret
                credentials_changed = True
        elif not config.pk or not config.api_secret:
            return Response({"error": "api_secret is required for new config."}, status=status.HTTP_400_BAD_REQUEST)

        if webhook_token is not None:
            config.webhook_token = str(webhook_token).strip()

        config.name = name or config.name
        if cod_charge_mode in ('seller', 'customer'):
            config.cod_charge_mode = cod_charge_mode
        if cod_percentage is not None:
            try:
                config.cod_percentage = float(cod_percentage)
            except (ValueError, TypeError):
                pass
        config.is_sandbox = bool(is_sandbox)
        config.is_active = bool(is_active)

        # Only verify against SteadFast external API if it's a new config or credentials changed!
        current_balance = None
        if not config.pk or credentials_changed:
            try:
                client = SteadFastCourierClient(config)
                balance_info = client.get_balance()
                current_balance = balance_info.get("current_balance") if balance_info else None
            except Exception as e:
                return Response({"error": f"Failed to verify SteadFast credentials: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        config.save()
        return Response({
            "message": "SteadFast configuration saved successfully!",
            "id": config.id,
            "current_balance": current_balance
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        from .models import SteadFastCourierConfig
        config_id = request.query_params.get("config_id") or request.data.get("config_id")
        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = SteadFastCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "No SteadFast configuration found to delete."}, status=status.HTTP_404_NOT_FOUND)
        config.delete()
        return Response({"message": "SteadFast courier configuration deleted successfully."}, status=status.HTTP_200_OK)


class SteadFastCityListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import SteadFastCity
        cities = list(SteadFastCity.objects.values("city_id", "city_name"))
        return Response(cities)


class SteadFastAreaListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import SteadFastArea
        city_id = request.query_params.get("city_id")
        if not city_id:
            return Response({"error": "city_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        areas = list(SteadFastArea.objects.filter(city__city_id=city_id).values("area_id", "area_name"))
        return Response(areas)


class SteadFastBookOrderView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import SteadFastCourierConfig, SteadFastBookingLog
        
        order_id = request.data.get("order_id")
        recipient_name = request.data.get("recipient_name")
        recipient_phone = request.data.get("recipient_phone")
        recipient_address = request.data.get("recipient_address")
        recipient_city_name = request.data.get("recipient_city_name") or request.data.get("city_name") or request.data.get("recipient_city")
        recipient_area_name = (
            request.data.get("recipient_area_name")
            or request.data.get("area_name")
            or request.data.get("recipient_thana")
            or request.data.get("thana_name")
            or request.data.get("recipient_area")
        )
        alternative_phone = request.data.get("alternative_phone") or request.data.get("alt_phone")
        recipient_email = request.data.get("recipient_email")
        special_instruction = request.data.get("special_instruction")
        item_description = request.data.get("item_description")
        cod_amount = request.data.get("amount_to_collect", request.data.get("cod_amount", 0))
        item_quantity = request.data.get("item_quantity", 1)
        item_weight = request.data.get("item_weight", 0.5)

        if not all([order_id, recipient_name, recipient_phone, recipient_address]):
            return Response({"error": "Required booking fields are missing."}, status=status.HTTP_400_BAD_REQUEST)
        
        # Phone validation: Official SteadFast API requires 11-digit phone numbers
        phone_digits = ''.join(filter(str.isdigit, str(recipient_phone)))
        if len(phone_digits) != 11:
            return Response({"error": f"Recipient phone must be 11 digits (received: {recipient_phone})."}, status=status.HTTP_400_BAD_REQUEST)
        
        alt_phone_digits = None
        if alternative_phone:
            alt_phone_digits = ''.join(filter(str.isdigit, str(alternative_phone)))
            if len(alt_phone_digits) != 11:
                return Response({"error": f"Alternative phone must be 11 digits (received: {alternative_phone})."}, status=status.HTTP_400_BAD_REQUEST)

        config_id = request.data.get("config_id") or request.query_params.get("config_id")
        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = SteadFastCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "SteadFast courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch the user's order
        order = get_object_or_404(CustomerOrder, id=order_id, user=request.user)

        merchant_order_id = f"ORD-{order.id}"
        address_parts = [str(recipient_address).strip()]
        if recipient_area_name:
            address_parts.append(f"Thana: {recipient_area_name}")
        if recipient_city_name:
            address_parts.append(f"District: {recipient_city_name}")
        full_address = ", ".join(address_parts)
        
        # SteadFast API requires recipient_address max 250 characters
        if len(full_address) > 250:
            full_address = full_address[:247] + "..."

        try:
            cod_amount_numeric = int(float(cod_amount or 0))
        except (TypeError, ValueError):
            cod_amount_numeric = 0

        try:
            item_quantity_numeric = int(item_quantity or 1)
        except (TypeError, ValueError):
            item_quantity_numeric = 1

        try:
            item_weight_numeric = float(item_weight or 0.5)
        except (TypeError, ValueError):
            item_weight_numeric = 0.5

        steadfast_payload = {
            "invoice": merchant_order_id,
            "recipient_name": str(recipient_name),
            "recipient_phone": str(recipient_phone),
            "recipient_address": full_address,
            "cod_amount": cod_amount_numeric
        }
        if alternative_phone:
            steadfast_payload["alternative_phone"] = str(alternative_phone)
        if recipient_email:
            steadfast_payload["recipient_email"] = str(recipient_email)
        if item_description:
            steadfast_payload["item_description"] = str(item_description)
        if special_instruction:
            steadfast_payload["note"] = str(special_instruction)

        # If the frontend is still sending numeric ID values under old fields, we accept them as fallback
        if not recipient_city_name and request.data.get("recipient_city"):
            recipient_city_name = str(request.data.get("recipient_city"))
        if not recipient_area_name and request.data.get("recipient_area"):
            recipient_area_name = str(request.data.get("recipient_area"))

        try:
            client = SteadFastCourierClient(config)
            booking_response = client.create_order(steadfast_payload)

            # Official API response structure: consignment_id is inside 'consignment' object, not 'data'
            consignment_id = booking_response.get("consignment", {}).get("consignment_id")
            
            # Validate response contains consignment_id
            if not consignment_id:
                error_msg = booking_response.get("message", "SteadFast API response missing consignment_id.")
                raise Exception(f"Invalid API response: {error_msg}")
            
            # Save booking log
            SteadFastBookingLog.objects.create(
                order=order,
                consignment_id=consignment_id,
                merchant_order_id=merchant_order_id,
                status="pending",
                response_data=booking_response
            )

            # Update order status
            order.status = "shipped"
            tracking_info = f"\nSteadFast Courier Tracking ID: {consignment_id}"
            if order.extra_info:
                order.extra_info += tracking_info
            else:
                order.extra_info = tracking_info.strip()
            order.save()

            return Response({
                "message": "Order successfully booked in SteadFast Courier!",
                "consignment_id": consignment_id,
                "status": "pending"
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response({"error": f"SteadFast Booking Failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)


class SteadFastOrderInfoView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, consignment_id):
        from .models import SteadFastCourierConfig, SteadFastBookingLog, CourierTimelineEvent
        config_id = request.query_params.get("config_id")
        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = SteadFastCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "SteadFast courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            client = SteadFastCourierClient(config)
            info = client.get_order_info(consignment_id)
            delivery_status = str(info.get("delivery_status") or "").strip().lower()

            # Self-healing sync: If parcel was deleted in SteadFast (delivery_status is unknown)
            if delivery_status == 'unknown':
                booking_log = SteadFastBookingLog.objects.filter(consignment_id=consignment_id).first()
                if booking_log and booking_log.status != 'cancelled':
                    booking_log.status = 'cancelled'
                    booking_log.save(update_fields=['status', 'updated_at'])
                    order = booking_log.order
                    if order and order.status == 'shipped':
                        order.status = 'confirmed'
                        order.save(update_fields=['status', 'updated_at'])
                        CourierTimelineEvent.objects.get_or_create(
                            order=order,
                            provider='steadfast',
                            consignment_id=str(consignment_id),
                            event_name='delivery_status:unknown',
                            defaults={
                                'status_label': 'পার্সেল কুরিয়ার থেকে ডিলিট/বাতিল হয়েছে',
                                'reason': 'SteadFast portal থেকে পার্সেল মুছে ফেলা হয়েছে',
                                'raw_payload': info
                            }
                        )
            return Response(info, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class SteadFastPriceCalculatorView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .models import SteadFastCourierConfig, SteadFastAreaPrice
        
        city_id = request.data.get("city_id") or request.data.get("recipient_city")
        area_id = request.data.get("area_id") or request.data.get("thana_id")
        item_weight = request.data.get("item_weight", 0.5)

        try:
            city_id_int = int(city_id) if city_id else None
        except (TypeError, ValueError):
            city_id_int = None

        try:
            weight_float = round(float(item_weight or 0.5), 2)
        except (TypeError, ValueError):
            weight_float = 0.5

        try:
            area_id_int = int(area_id) if area_id else None
        except (TypeError, ValueError):
            area_id_int = None

        if city_id_int is None:
            return Response({
                "delivery_fee": 0.0,
                "cod_charge": 0.0,
                "total_amount": 0.0,
                "note": "SteadFast does not support live price calculation without a valid city_id; proceed with order booking instead."
            }, status=status.HTTP_200_OK)

        # 1. Try to fetch from local database cache first (valid for 3 days)
        cache_expiry_limit = timezone.now() - timedelta(days=3)
        cached_price = None
        if area_id_int is not None:
            cached_price = SteadFastAreaPrice.objects.filter(
                city_id=city_id_int,
                area_id=area_id_int,
                weight=weight_float,
                updated_at__gte=cache_expiry_limit
            ).first()

        if cached_price:
            return Response({
                "delivery_fee": float(cached_price.delivery_fee),
                "cod_charge": float(cached_price.cod_charge),
                "total_amount": float(cached_price.total_amount)
            }, status=status.HTTP_200_OK)

        if area_id_int is None:
            return Response({
                "delivery_fee": 0.0,
                "cod_charge": 0.0,
                "total_amount": 0.0,
                "note": "SteadFast does not support live price calculation by area/city IDs; proceed with booking using full recipient_address."
            }, status=status.HTTP_200_OK)

        # 2. If not cached or cache is stale, perform live API call
        config_id = request.data.get("config_id") or request.query_params.get("config_id")
        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
        else:
            config = SteadFastCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "SteadFast courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        payload = {
            "city_id": city_id_int,
            "weight": weight_float
        }
        if area_id_int is not None:
            payload["area_id"] = area_id_int

        try:
            client = SteadFastCourierClient(config)
            price_details = client.calculate_price(payload)

            # 3. Store/Update result in database cache for future requests
            if area_id_int is not None:
                SteadFastAreaPrice.objects.update_or_create(
                    city_id=city_id_int,
                    area_id=area_id_int,
                    weight=weight_float,
                    defaults={
                        "delivery_fee": price_details.get("delivery_charge", 0.0),
                        "cod_charge": price_details.get("cod_charge", 0.0),
                        "total_amount": price_details.get("total_charge", 0.0)
                    }
                )

            return Response(price_details, status=status.HTTP_200_OK)
        except Exception as e:
            # Fallback to expired cache if API is down
            if area_id_int is not None:
                fallback_price = SteadFastAreaPrice.objects.filter(
                    city_id=city_id_int,
                    area_id=area_id_int,
                    weight=weight_float
                ).first()
                if fallback_price:
                    return Response({
                        "delivery_fee": float(fallback_price.delivery_fee),
                        "cod_charge": float(fallback_price.cod_charge),
                        "total_amount": float(fallback_price.total_amount),
                        "is_fallback": True
                    }, status=status.HTTP_200_OK)

            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class CourierSuggestedAddressView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        order_id = request.query_params.get("order_id")
        if not order_id:
            return Response({"error": "order_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        order = get_object_or_404(CustomerOrder, id=order_id, user=request.user)
        from .utils.redis_courier_cache import match_address_redis, extract_location_from_address
        district = order.district
        upazila = order.upazila
        if not district or not upazila:
            district, upazila = extract_location_from_address(order.address)
        suggestions = match_address_redis(district, upazila, full_address=order.address)
        return Response(suggestions, status=status.HTTP_200_OK)


# ─── COURIER STATUS WEBHOOK HANDLERS ───────────────────────────────────────

class PathaoWebhookView(APIView):
    """
    POST /api/courier/webhooks/pathao/
    Receives real-time parcel lifecycle webhooks from Pathao Courier:
    - order.created, order.pickup-requested, order.assigned-for-pickup
    - order.picked, order.in-transit
    - order.delivered
    - order.returned, order.return-in-transit
    - order.pickup-cancelled, order.cancelled
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, merchant_identifier=None):
        payload = request.data or {}
        logger.info(f"🔔 [PathaoWebhook] Received event (merchant={merchant_identifier}): {payload} | headers: {dict(request.headers)}")

        # 1. Resolve merchant config dynamically (if merchant_identifier provided in URL or store_id in payload)
        merchant_config = None
        if merchant_identifier:
            clean_m = str(merchant_identifier).strip()
            if clean_m.isdigit():
                merchant_config = PathaoCourierConfig.objects.filter(user_id=int(clean_m), is_active=True).first()
            if not merchant_config:
                merchant_config = PathaoCourierConfig.objects.filter(user__email=clean_m, is_active=True).first()

        store_id = str(payload.get('store_id') or '').strip()
        if not merchant_config and store_id:
            merchant_config = PathaoCourierConfig.objects.filter(store_id=store_id, is_active=True).first()

        # Dynamic Webhook secret priority:
        # 1. Merchant's saved webhook_secret in DB
        # 2. Incoming header from Pathao
        # 3. Environment variable fallback
        webhook_secret = None
        if merchant_config and merchant_config.webhook_secret:
            webhook_secret = merchant_config.webhook_secret
        if not webhook_secret:
            webhook_secret = (
                request.headers.get('X-Pathao-Merchant-Webhook-Integration-Secret') or
                os.getenv('PATHAO_WEBHOOK_SECRET') or
                ''
            )

        event_name = str(payload.get('event_name') or payload.get('event') or '').strip().lower()
        order_status = str(payload.get('order_status') or payload.get('status') or '').strip().lower()
        consignment_id = str(payload.get('consignment_id') or payload.get('tracking_id') or '').strip()
        merchant_order_id = str(payload.get('merchant_order_id') or '').strip()

        # Check if this is a Pathao Webhook verification/handshake challenge (e.g. empty or test ping)
        if not consignment_id and not merchant_order_id:
            logger.info(f"[PathaoWebhook] Verification handshake challenge for merchant {merchant_identifier}. Responding with 202 and Secret Header.")
            resp = Response(
                {"status": "accepted", "message": "Pathao webhook endpoint verified successfully"},
                status=status.HTTP_202_ACCEPTED
            )
            if webhook_secret:
                resp['X-Pathao-Merchant-Webhook-Integration-Secret'] = webhook_secret
            return resp

        # 1. Locate PathaoBookingLog and CustomerOrder
        booking_log = None
        if consignment_id:
            booking_log = PathaoBookingLog.objects.select_related('order').filter(consignment_id=consignment_id).first()
        if not booking_log and merchant_order_id:
            clean_oid = merchant_order_id.replace('ORD-', '').replace('#', '').strip()
            if clean_oid.isdigit():
                booking_log = PathaoBookingLog.objects.select_related('order').filter(order_id=int(clean_oid)).first()

        order = booking_log.order if booking_log else None
        if not order and merchant_order_id:
            clean_oid = merchant_order_id.replace('ORD-', '').replace('#', '').strip()
            if clean_oid.isdigit():
                order = CustomerOrder.objects.filter(id=int(clean_oid)).first()

        if not order and consignment_id:
            order = CustomerOrder.objects.filter(extra_info__icontains=consignment_id).first()

        if not order:
            logger.warning(f"[PathaoWebhook] No matching order found for consignment {consignment_id} / {merchant_order_id}")
            return Response({"status": "ignored", "message": "Order not found in database"}, status=status.HTTP_200_OK)

        # 2. Determine target status
        # Pathao cancel variants
        is_cancel = (
            'cancel' in event_name or
            'cancel' in order_status or
            event_name in ('order.pickup-cancelled', 'order.cancelled') or
            order_status in ('pickup cancel', 'pickup_cancelled', 'cancelled', 'order_cancelled')
        )
        # Pathao return variants
        is_return = (
            'return' in event_name or
            'return' in order_status or
            event_name in ('order.returned', 'order.return-in-transit') or
            order_status in ('returned', 'return', 'return_in_transit', 'failed_delivery')
        )
        # Pathao delivered
        is_delivered = (
            event_name == 'order.delivered' or
            order_status in ('delivered', 'order_delivered', 'completed')
        )
        # In transit / Picked
        is_shipped = (
            event_name in ('order.picked', 'order.in-transit', 'order.assigned-for-pickup') or
            order_status in ('picked', 'in transit', 'in_transit', 'assigned_for_pickup')
        )

        now = timezone.now()
        updated_fields = ['updated_at']

        # Human-readable status mapping
        status_label_map = {
            'order.created': 'অর্ডার কুরিয়ারে বুকিং হয়েছে',
            'order.pickup-requested': 'পিকআপ রিকোয়েস্ট পাঠানো হয়েছে',
            'order.assigned-for-pickup': 'রাইডারকে পিকআপের জন্য নির্ধারণ করা হয়েছে',
            'order.picked': 'রাইডার পার্সেল সংগ্রহ করেছে',
            'order.at-the-sorting-hub': 'সর্টিং হাবে প্রক্রিয়াজাত হচ্ছে',
            'order.in-transit': 'পার্সেল ট্রানজিটে রয়েছে',
            'order.received-at-last-mile-hub': 'ডেলিভারি হাবে পৌঁছেছে',
            'order.assigned-for-delivery': 'আজ ডেলিভারির জন্য বের হয়েছে',
            'order.delivered': 'ডেলিভারি সম্পন্ন হয়েছে',
            'order.partial-delivered': 'আংশিক ডেলিভারি সম্পন্ন হয়েছে',
            'order.returned': 'পার্সেলটি রিটার্ন করা হয়েছে',
            'order.return-in-transit': 'পার্সেলটি সেলারের কাছে ফেরত পাঠানো হচ্ছে',
            'order.delivery-failed': 'ডেলিভারি ব্যর্থ হয়েছে',
            'order.on-hold': 'ডেলিভারি সাময়িক স্থগিত আছে',
            'order.pickup-cancelled': 'পিকআপ বাতিল করা হয়েছে',
            'order.cancelled': 'অর্ডার বাতিল করা হয়েছে',
        }
        human_status = status_label_map.get(event_name) or order_status or event_name
        failure_reason = str(payload.get('reason') or payload.get('note') or payload.get('order_status') or '')

        if is_cancel:
            order.status = 'cancelled'
            if not order.call_notes or 'cancel' not in str(order.call_notes).lower():
                order.call_notes = f"Cancelled via Pathao Courier ({payload.get('order_status') or event_name})"
                updated_fields.append('call_notes')
            updated_fields.append('status')
            raw_log_status = 'cancelled'
            logger.info(f"🚨 [PathaoWebhook] Order #{order.id} marked CANCELLED from Pathao event.")
        elif is_return:
            order.status = 'returned'
            updated_fields.append('status')
            raw_log_status = 'returned'
            logger.info(f"📦 [PathaoWebhook] Order #{order.id} marked RETURNED from Pathao event.")
        elif is_delivered:
            order.status = 'delivered'
            updated_fields.append('status')
            raw_log_status = 'delivered'
            logger.info(f"✅ [PathaoWebhook] Order #{order.id} marked DELIVERED from Pathao event.")
        elif is_shipped and order.status != 'delivered':
            order.status = 'shipped'
            updated_fields.append('status')
            raw_log_status = 'in_transit'
        else:
            raw_log_status = order_status or event_name

        order.updated_at = now
        order.save(update_fields=list(set(updated_fields)))

        # 3. Create CourierTimelineEvent
        try:
            from .models import CourierTimelineEvent
            CourierTimelineEvent.objects.create(
                order=order,
                provider='pathao',
                consignment_id=consignment_id or '',
                event_name=event_name,
                status_label=human_status,
                reason=failure_reason if (is_cancel or is_return or 'fail' in event_name or 'hold' in event_name) else '',
                raw_payload=payload
            )
        except Exception as timeline_err:
            logger.warning(f"[PathaoWebhook] Failed to save CourierTimelineEvent: {timeline_err}")

        # 4. Notify Customer on Messenger/WhatsApp asynchronously
        try:
            from .tasks import notify_customer_courier_update_task
            notify_customer_courier_update_task.delay(order.id, event_name, human_status, failure_reason)
        except Exception as task_err:
            logger.warning(f"[PathaoWebhook] Failed to dispatch customer notification task: {task_err}")

        # 5. Broadcast Realtime WebSocket event to Seller Dashboard
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
                            "courier_provider": "pathao",
                            "consignment_id": consignment_id,
                            "event_name": event_name,
                            "status_label": human_status,
                            "reason": failure_reason,
                            "customer_name": order.customer_name,
                        }
                    }
                )
        except Exception as ws_err:
            logger.debug(f"[PathaoWebhook] WebSocket broadcast error: {ws_err}")

        # Update PathaoBookingLog status & response_data
        if booking_log:
            booking_log.status = raw_log_status
            existing_data = booking_log.response_data if isinstance(booking_log.response_data, dict) else {}
            existing_data['last_webhook_event'] = payload
            existing_data['last_webhook_at'] = now.isoformat()
            booking_log.response_data = existing_data
            booking_log.save(update_fields=['status', 'response_data', 'updated_at'])

        resp = Response({
            "status": "success",
            "order_id": order.id,
            "order_status": order.status,
            "courier_status": raw_log_status
        }, status=status.HTTP_200_OK)
        resp['X-Pathao-Merchant-Webhook-Integration-Secret'] = webhook_secret
        return resp


class SteadFastWebhookView(APIView):
    """
    POST /api/courier/webhooks/steadfast/
    POST /api/courier/webhooks/steadfast/<str:merchant_identifier>/
    POST /api/webhooks/steadfast/<str:merchant_identifier>/

    Receives real-time parcel lifecycle and account webhooks from Steadfast Courier:
    - Events: delivery_status, tracking_update, consignment_update, cancel_request, return_request, etc.
    - Security: HMAC-SHA256 of raw request body verified against X-Signature using merchant webhook_token,
      plus Authorization: Bearer <token>.
    - Idempotency: Deduplicates retries using Idempotency-Key header via Redis.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request, merchant_identifier=None):
        raw_body = request.body or b''
        payload = request.data if isinstance(request.data, dict) else {}
        logger.info(f"🔔 [SteadFastWebhook] Received event. URL param: {merchant_identifier} | Payload: {payload}")

        # 1. Immediate 200 OK for ping / health-check / empty test payloads
        if not payload or payload.get('test') or payload.get('notification_type') == 'test':
            return Response({"status": "accepted", "message": "SteadFast webhook endpoint verified successfully"}, status=status.HTTP_200_OK)

        # 2. Idempotency-Key handling (ignore retried duplicate requests)
        idempotency_key = (
            request.headers.get('Idempotency-Key')
            or request.META.get('HTTP_IDEMPOTENCY_KEY')
            or ''
        ).strip()
        if idempotency_key:
            try:
                from django_redis import get_redis_connection
                r = get_redis_connection("default")
                idemp_cache_key = f"steadfast_webhook_idemp:{idempotency_key}"
                if r.get(idemp_cache_key):
                    logger.info(f"🔁 [SteadFastWebhook] Duplicate event skipped via Idempotency-Key: {idempotency_key}")
                    return Response({"status": "success", "message": "Event already processed"}, status=status.HTTP_200_OK)
                r.setex(idemp_cache_key, 86400, "1")
            except Exception as idemp_err:
                logger.debug(f"[SteadFastWebhook] Redis idempotency check failed: {idemp_err}")

        # 3. Locate Merchant Config
        merchant_config = None
        if merchant_identifier:
            clean_ident = str(merchant_identifier).strip()
            if clean_ident.isdigit():
                merchant_config = SteadFastCourierConfig.objects.filter(user_id=int(clean_ident), is_active=True).first()
            if not merchant_config:
                merchant_config = SteadFastCourierConfig.objects.filter(webhook_token=clean_ident, is_active=True).first()
            if not merchant_config:
                merchant_config = SteadFastCourierConfig.objects.filter(api_secret=clean_ident, is_active=True).first()

        # If not resolved from URL, check Authorization: Bearer <token>
        auth_header = (
            request.headers.get('Authorization')
            or request.META.get('HTTP_AUTHORIZATION')
            or ''
        ).strip()
        bearer_token = None
        if auth_header.lower().startswith('bearer '):
            bearer_token = auth_header[7:].strip()
            if not merchant_config and bearer_token:
                merchant_config = SteadFastCourierConfig.objects.filter(webhook_token=bearer_token, is_active=True).first()
                if not merchant_config:
                    merchant_config = SteadFastCourierConfig.objects.filter(api_secret=bearer_token, is_active=True).first()

        # 4. HMAC-SHA256 Signature Verification
        given_sig = (
            request.headers.get('X-Signature')
            or request.META.get('HTTP_X_SIGNATURE')
            or ''
        ).strip()

        secret_candidates = []
        if merchant_config:
            if getattr(merchant_config, 'webhook_token', None):
                secret_candidates.append(merchant_config.webhook_token)
            if getattr(merchant_config, 'api_secret', None):
                secret_candidates.append(merchant_config.api_secret)
        if bearer_token:
            secret_candidates.append(bearer_token)

        if given_sig and secret_candidates:
            matched = False
            for sec in secret_candidates:
                expected_sig = hmac.new(sec.encode('utf-8'), raw_body, hashlib.sha256).hexdigest()
                if hmac.compare_digest(expected_sig, given_sig):
                    matched = True
                    break
            if not matched:
                logger.warning(
                    f"❌ [SteadFastWebhook] Invalid HMAC signature for merchant #{merchant_config.user_id if merchant_config else 'unknown'}. "
                    f"Given: {given_sig[:10]}..."
                )
                return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # 5. Extract Event Fields
        notification_type = str(payload.get('notification_type') or 'delivery_status').strip().lower()
        consignment_id = str(payload.get('consignment_id') or payload.get('tracking_code') or '').strip()
        invoice = str(payload.get('invoice') or payload.get('merchant_order_id') or '').strip()
        sf_status = str(payload.get('status') or '').strip().lower()
        tracking_message = str(payload.get('tracking_message') or payload.get('message') or payload.get('note') or payload.get('reason') or '').strip()

        # If non-consignment notification (e.g. user_update, payment_request)
        if not consignment_id and not invoice:
            logger.info(f"ℹ️ [SteadFastWebhook] Handled non-consignment event: {notification_type}")
            return Response({"status": "success", "notification_type": notification_type}, status=status.HTTP_200_OK)

        # 6. Locate Order and Booking Log
        booking_log = None
        if consignment_id:
            booking_log = SteadFastBookingLog.objects.select_related('order').filter(consignment_id=consignment_id).first()
        if not booking_log and invoice:
            clean_oid = invoice.replace('ORD-', '').replace('INV-', '').replace('#', '').strip()
            if clean_oid.isdigit():
                booking_log = SteadFastBookingLog.objects.select_related('order').filter(order_id=int(clean_oid)).first()

        order = booking_log.order if booking_log else None
        if not order and invoice:
            clean_oid = invoice.replace('ORD-', '').replace('INV-', '').replace('#', '').strip()
            if clean_oid.isdigit():
                order = CustomerOrder.objects.filter(id=int(clean_oid)).first()
            if not order:
                import uuid
                try:
                    uuid.UUID(str(invoice).strip())
                    order = CustomerOrder.objects.filter(public_id=invoice).first()
                except (ValueError, TypeError, AttributeError):
                    pass

        if not order and consignment_id:
            order = CustomerOrder.objects.filter(extra_info__icontains=consignment_id).first()

        if not order:
            logger.warning(f"⚠️ [SteadFastWebhook] No matching order found for consignment {consignment_id} / invoice {invoice}")
            return Response({"status": "ignored", "message": "Order not found"}, status=status.HTTP_200_OK)

        # If merchant config was not resolved from URL/header, resolve from order now
        if not merchant_config and order.user_id:
            merchant_config = SteadFastCourierConfig.objects.filter(user_id=order.user_id, is_active=True).first()
            if merchant_config and merchant_config.webhook_token:
                expected_sig = hmac.new(
                    merchant_config.webhook_token.encode('utf-8'),
                    raw_body,
                    hashlib.sha256
                ).hexdigest()
                if not given_sig or not hmac.compare_digest(expected_sig, given_sig):
                    logger.warning(f"❌ [SteadFastWebhook] Signature check failed for order #{order.id}")
                    return Response({"error": "Invalid signature"}, status=status.HTTP_401_UNAUTHORIZED)

        # 7. Map Status to Bengali and Order Status
        now = timezone.now()
        updated_fields = ['updated_at']

        sf_label_map = {
            'pending': 'কুরিয়ার বুকিং পেন্ডিং',
            'in_review': 'অর্ডার রিভিউতে আছে',
            'delivered': 'ডেলিভারি সম্পন্ন হয়েছে',
            'delivered_approval_pending': 'ডেলিভারি অনুমোদন পেন্ডিং',
            'partial_delivered': 'আংশিক ডেলিভারি সম্পন্ন হয়েছে',
            'partial_delivered_approval_pending': 'আংশিক ডেলিভারি অনুমোদন পেন্ডিং',
            'cancelled': 'পার্সেল বাতিল করা হয়েছে',
            'cancelled_approval_pending': 'বাতিল অনুমোদন পেন্ডিং',
            'unknown': 'পার্সেল কুরিয়ার থেকে ডিলিট/বাতিল হয়েছে',
            'hold': 'পার্সেল সাময়িক হোল্ডে আছে',
            'in_transit': 'পার্সেল ট্রানজিটে রয়েছে',
            'transit': 'পার্সেল ট্রানজিটে রয়েছে',
            'shipped': 'পার্সেল কুরিয়ারের পথে',
            'return': 'পার্সেল রিটার্ন করা হয়েছে',
            'delivery_status': 'ডেলিভারি স্ট্যাটাস আপডেট',
            'tracking_update': 'নতুন ট্র্যাকিং আপডেট',
            'cancel_request': 'বাতিলের অনুরোধ',
            'return_request': 'রিটার্নের অনুরোধ',
            'pickup_request': 'পিকআপের অনুরোধ',
        }

        human_status = sf_label_map.get(sf_status) or sf_label_map.get(notification_type) or tracking_message or sf_status or 'আপডেট'
        failure_reason = tracking_message or str(payload.get('reason') or payload.get('note') or '')

        if sf_status in ('cancelled', 'cancelled_approval_pending', 'unknown') or notification_type in ('cancel_request', 'parcel_deleted'):
            raw_log_status = 'cancelled'
            if sf_status == 'unknown':
                human_status = 'পার্সেল কুরিয়ার থেকে ডিলিট/বাতিল হয়েছে'
                failure_reason = failure_reason or 'SteadFast portal থেকে পার্সেল মুছে ফেলা হয়েছে'
                if order.status == 'shipped':
                    order.status = 'confirmed'
                    updated_fields.append('status')
            else:
                order.status = 'cancelled'
                updated_fields.append('status')

            if not order.call_notes or 'steadfast' not in str(order.call_notes).lower():
                order.call_notes = f"SteadFast parcel removed/cancelled ({sf_status or notification_type})"
                updated_fields.append('call_notes')
            logger.info(f"🚨 [SteadFastWebhook] Order #{order.id} marked CANCELLED/REMOVED from SteadFast ({sf_status}). Order status set to {order.status}.")
        elif sf_status in ('delivered', 'delivered_approval_pending'):
            order.status = 'delivered'
            updated_fields.append('status')
            raw_log_status = 'delivered'
            logger.info(f"✅ [SteadFastWebhook] Order #{order.id} marked DELIVERED from SteadFast.")
        elif sf_status in ('partial_delivered', 'partial_delivered_approval_pending', 'return') or notification_type in ('return_request', 'return_list_accepted'):
            order.status = 'returned'
            updated_fields.append('status')
            raw_log_status = 'returned'
        elif (sf_status in ('in_review', 'transit', 'shipped', 'in_transit') or notification_type == 'tracking_update') and order.status != 'delivered':
            order.status = 'shipped'
            updated_fields.append('status')
            raw_log_status = 'in_transit'
        else:
            raw_log_status = sf_status or notification_type or 'pending'

        order.updated_at = now
        order.save(update_fields=list(set(updated_fields)))

        # 8. Create CourierTimelineEvent
        try:
            from .models import CourierTimelineEvent
            CourierTimelineEvent.objects.create(
                order=order,
                provider='steadfast',
                consignment_id=consignment_id or '',
                event_name=f"{notification_type}:{sf_status}" if sf_status else notification_type,
                status_label=human_status,
                reason=failure_reason if (sf_status in ('cancelled', 'return', 'hold') or 'fail' in sf_status or 'hold' in sf_status) else '',
                raw_payload=payload
            )
        except Exception as timeline_err:
            logger.warning(f"[SteadFastWebhook] Failed to save CourierTimelineEvent: {timeline_err}")

        # 9. Notify Customer across all platforms (Messenger, WhatsApp, Telegram, Instagram)
        try:
            from .tasks import notify_customer_courier_update_task
            notify_customer_courier_update_task.delay(order.id, sf_status or notification_type, human_status, failure_reason)
        except Exception as task_err:
            logger.warning(f"[SteadFastWebhook] Failed to dispatch customer notification task: {task_err}")

        # 10. Broadcast Realtime WebSocket event to Seller Dashboard
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
                            "courier_provider": "steadfast",
                            "consignment_id": consignment_id,
                            "event_name": sf_status or notification_type,
                            "status_label": human_status,
                            "reason": failure_reason,
                            "customer_name": order.customer_name,
                        }
                    }
                )
        except Exception as ws_err:
            logger.debug(f"[SteadFastWebhook] WebSocket broadcast error: {ws_err}")

        # 11. Update SteadFastBookingLog
        if booking_log:
            booking_log.status = raw_log_status
            existing_data = booking_log.response_data if isinstance(booking_log.response_data, dict) else {}
            existing_data['last_webhook_event'] = payload
            existing_data['last_webhook_at'] = now.isoformat()
            booking_log.response_data = existing_data
            booking_log.save(update_fields=['status', 'response_data', 'updated_at'])

        return Response({
            "status": "success",
            "order_id": order.id,
            "order_status": order.status,
            "courier_status": raw_log_status
        }, status=status.HTTP_200_OK)

