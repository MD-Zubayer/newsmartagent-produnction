import os
import requests
import logging
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from users.authentication import CookieJWTAuthentication
from django.shortcuts import get_object_or_404

from .models import PathaoCourierConfig, PathaoBookingLog, PathaoZonePrice
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

        # Otherwise, request a new token
        url = f"{self.base_url}/aladdin/api/v1/issue-token"
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
                expires_in = response_data.get("expires_in", 31536000)
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
            return data.get("data", {})
        raise Exception(f"Failed to fetch order info: {response.text}")

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

class PathaoCourierConfigView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get_config(self, request, config_id=None):
        if config_id:
            return PathaoCourierConfig.objects.filter(id=config_id, user=request.user).first()
        return PathaoCourierConfig.objects.filter(user=request.user).first()

    def get(self, request):
        configs = PathaoCourierConfig.objects.filter(user=request.user)
        return Response([
            {
                "id": config.id,
                "name": config.name,
                "client_id": config.client_id,
                "username": config.username,
                "store_id": config.store_id,
                "is_sandbox": config.is_sandbox,
                "is_active": config.is_active,
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
        name = request.data.get("name")
        is_sandbox = request.data.get("is_sandbox", True)
        is_active = request.data.get("is_active", True)

        if not all([client_id, client_secret, username]):
            return Response({"error": "client_id, client_secret, and username are required."}, status=status.HTTP_400_BAD_REQUEST)

        if config_id:
            config = self._get_config(request, config_id)
            if not config:
                return Response({"error": "Pathao configuration not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            config = PathaoCourierConfig(user=request.user)

        config.name = name or config.name
        config.client_id = client_id
        config.client_secret = client_secret
        config.username = username
        if password:
            config.password = password
        elif not config.pk:
            return Response({"error": "password is required for new config."}, status=status.HTTP_400_BAD_REQUEST)
        config.store_id = store_id
        config.is_sandbox = is_sandbox
        config.is_active = is_active
        config.access_token = None
        config.token_expires_at = None

        try:
            client = PathaoCourierClient(config)
            client.get_access_token()
            config.save()
            return Response({"message": "Pathao credentials verified and saved successfully!", "id": config.id}, status=status.HTTP_200_OK)
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
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import PathaoCity
        cities = list(PathaoCity.objects.values("city_id", "city_name"))
        return Response(cities)


class PathaoZoneListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        city_id = request.query_params.get("city_id")
        if not city_id:
            return Response({"error": "city_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        from .models import PathaoZone
        zones = list(PathaoZone.objects.filter(city__city_id=city_id).values("zone_id", "zone_name"))
        return Response(zones)


class PathaoAreaListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

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
        return Response([
            {
                "id": config.id,
                "name": config.name,
                "api_key": config.api_key,
                "is_sandbox": config.is_sandbox,
                "is_active": config.is_active,
            }
            for config in configs
        ])

    def post(self, request):
        from .models import SteadFastCourierConfig
        config_id = request.data.get("config_id")
        api_key = request.data.get("api_key")
        api_secret = request.data.get("api_secret")
        name = request.data.get("name")
        is_sandbox = request.data.get("is_sandbox", True)
        is_active = request.data.get("is_active", True)

        if not all([api_key, api_secret]):
            return Response({"error": "api_key and api_secret are required."}, status=status.HTTP_400_BAD_REQUEST)

        if config_id:
            config = SteadFastCourierConfig.objects.filter(id=config_id, user=request.user).first()
            if not config:
                return Response({"error": "SteadFast configuration not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            config, created = SteadFastCourierConfig.objects.get_or_create(user=request.user)

        config.api_key = api_key
        config.api_secret = api_secret
        config.name = name or config.name
        config.is_sandbox = is_sandbox
        config.is_active = is_active
        
        try:
            client = SteadFastCourierClient(config)
            client.get_cities()
            config.save()
            return Response({"message": "SteadFast credentials verified and saved successfully!", "id": config.id}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
        from .models import SteadFastCourierConfig
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
