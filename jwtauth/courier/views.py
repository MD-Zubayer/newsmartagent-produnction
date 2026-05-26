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

from .models import PathaoCourierConfig, PathaoBookingLog
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
            response_data = response.json()
            
            if response.status_code == 200 and "access_token" in response_data:
                self.config.access_token = response_data["access_token"]
                self.config.refresh_token = response_data.get("refresh_token")
                expires_in = response_data.get("expires_in", 31536000)
                self.config.token_expires_at = timezone.now() + timedelta(seconds=expires_in)
                self.config.save(update_fields=["access_token", "refresh_token", "token_expires_at"])
                return self.config.access_token
            else:
                logger.error(f"Failed to issue Pathao token: {response.text}")
                error_msg = response_data.get("message", "Authentication with Pathao API failed.")
                if "errors" in response_data:
                    error_msg += f" {response_data['errors']}"
                raise Exception(error_msg)
        except Exception as e:
            logger.error(f"Pathao connection error: {str(e)}")
            raise Exception(f"Unable to connect to Pathao Courier. Please check credentials. Error: {str(e)}")

    def get_stores(self):
        url = f"{self.base_url}/aladdin/api/v1/stores"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch stores: {response.text}")

    def get_cities(self):
        url = f"{self.base_url}/aladdin/api/v1/cities"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch cities: {response.text}")

    def get_zones(self, city_id):
        url = f"{self.base_url}/aladdin/api/v1/cities/{city_id}/zones"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch zones: {response.text}")

    def get_areas(self, zone_id):
        url = f"{self.base_url}/aladdin/api/v1/zones/{zone_id}/areas"
        response = requests.get(url, headers=self.get_headers(), timeout=15)
        if response.status_code == 200:
            return response.json().get("data", {}).get("data", [])
        raise Exception(f"Failed to fetch areas: {response.text}")

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


# --- API VIEWS ---

class PathaoCourierConfigView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "Pathao configuration not found"}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            "client_id": config.client_id,
            "client_secret": config.client_secret,
            "username": config.username,
            "store_id": config.store_id,
            "is_sandbox": config.is_sandbox,
            "is_active": config.is_active
        })

    def post(self, request):
        client_id = request.data.get("client_id")
        client_secret = request.data.get("client_secret")
        username = request.data.get("username")
        password = request.data.get("password")
        store_id = request.data.get("store_id")
        is_sandbox = request.data.get("is_sandbox", True)
        is_active = request.data.get("is_active", True)

        if not all([client_id, client_secret, username]):
            return Response({"error": "client_id, client_secret, and username are required."}, status=status.HTTP_400_BAD_REQUEST)

        config, created = PathaoCourierConfig.objects.get_or_create(user=request.user)
        config.client_id = client_id
        config.client_secret = client_secret
        config.username = username
        if password:  # Only update password if provided
            config.password = password
        config.store_id = store_id
        config.is_sandbox = is_sandbox
        config.is_active = is_active
        
        # Clear token cache to force verify on next API call
        config.access_token = None
        config.token_expires_at = None
        
        try:
            # Verify credentials immediately by trying to fetch token
            client = PathaoCourierClient(config)
            client.get_access_token()
            config.save()
            return Response({"message": "Pathao credentials verified and saved successfully!"}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "No Pathao configuration found to delete."}, status=status.HTTP_404_NOT_FOUND)
        config.delete()
        return Response({"message": "Pathao courier configuration deleted successfully."}, status=status.HTTP_200_OK)


class PathaoStoreListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "Pathao configuration not set"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = PathaoCourierClient(config)
            stores = client.get_stores()
            return Response(stores)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoCityListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "Pathao configuration not set"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = PathaoCourierClient(config)
            cities = client.get_cities()
            return Response(cities)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoZoneListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        city_id = request.query_params.get("city_id")
        if not city_id:
            return Response({"error": "city_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "Pathao configuration not set"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = PathaoCourierClient(config)
            zones = client.get_zones(city_id)
            return Response(zones)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoAreaListView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        zone_id = request.query_params.get("zone_id")
        if not zone_id:
            return Response({"error": "zone_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config:
            return Response({"error": "Pathao configuration not set"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            client = PathaoCourierClient(config)
            areas = client.get_areas(zone_id)
            return Response(areas)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class PathaoBookOrderView(APIView):
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("order_id")
        store_id = request.data.get("store_id")
        recipient_name = request.data.get("recipient_name")
        recipient_phone = request.data.get("recipient_phone")
        recipient_address = request.data.get("recipient_address")
        recipient_city = request.data.get("recipient_city")
        recipient_zone = request.data.get("recipient_zone")
        recipient_area = request.data.get("recipient_area")
        
        item_quantity = request.data.get("item_quantity", 1)
        item_weight = request.data.get("item_weight", 0.5)
        amount_to_collect = request.data.get("amount_to_collect", 0)
        item_description = request.data.get("item_description", "Order Parcel")
        delivery_type = request.data.get("delivery_type", 48)  # 48 = Normal
        item_type = request.data.get("item_type", 2)  # 2 = Parcel

        if not all([order_id, recipient_name, recipient_phone, recipient_address]):
            return Response({"error": "Required booking fields (name, phone, address) are missing."}, status=status.HTTP_400_BAD_REQUEST)

        config = PathaoCourierConfig.objects.filter(user=request.user).first()
        if not config or not config.is_active:
            return Response({"error": "Pathao courier service is not configured or is inactive."}, status=status.HTTP_400_BAD_REQUEST)

        # Get default store if not specified
        final_store_id = store_id or config.store_id
        if not final_store_id:
            return Response({"error": "Store ID is required for courier booking."}, status=status.HTTP_400_BAD_REQUEST)

        # Get target order
        order = get_object_or_404(CustomerOrder, id=order_id, user=request.user)

        # Prep Pathao request payload (Auto Address feature handles City/Zone/Area)
        pathao_payload = {
            "store_id": int(final_store_id),
            "merchant_order_id": f"ORD-{order.id}",
            "recipient_name": recipient_name,
            "recipient_phone": recipient_phone,
            "recipient_address": recipient_address,
            "delivery_type": int(delivery_type),
            "item_type": int(item_type),
            "item_quantity": int(item_quantity),
            "item_weight": float(item_weight),
            "amount_to_collect": float(amount_to_collect),
            "item_description": item_description
        }

        try:
            client = PathaoCourierClient(config)
            booking_response = client.create_order(pathao_payload)
            
            # Booking success!
            consignment_id = booking_response.get("data", {}).get("consignment_id")
            consignment_status = booking_response.get("data", {}).get("status", "Order Created")

            # Create booking log
            booking_log = PathaoBookingLog.objects.create(
                order=order,
                consignment_id=consignment_id,
                merchant_order_id=pathao_payload["merchant_order_id"],
                status=consignment_status,
                response_data=booking_response
            )

            # Update order status to shipped and append extra details
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
