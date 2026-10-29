import os
import logging
import requests
import jwt
from datetime import datetime, timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework import exceptions

from .models import Customer

logger = logging.getLogger(__name__)

JWT_SECRET = getattr(settings, 'SECRET_KEY', 'customer-jwt-secret-fallback')
JWT_ALGORITHM = 'HS256'
CUSTOMER_TOKEN_COOKIE = 'customer_token'
CUSTOMER_TOKEN_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def verify_google_id_token(id_token: str) -> dict:
    """
    Verifies the Google ID token against Google's tokeninfo endpoint.
    Returns user info dict if valid, otherwise raises ValueError.
    """
    if not id_token:
        raise ValueError("ID token is required")

    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            error_data = response.json() if response.content else {}
            raise ValueError(f"Google token verification failed: {error_data.get('error_description', 'Invalid token')}")

        data = response.json()
        google_sub = data.get('sub')
        email = data.get('email')
        
        if not google_sub or not email:
            raise ValueError("Token missing required claims (sub, email)")

        return {
            "sub": google_sub,
            "email": email,
            "name": data.get('name') or email.split('@')[0],
            "picture": data.get('picture', ''),
            "email_verified": data.get('email_verified') in (True, 'true', 'True', 1),
        }
    except requests.RequestException as e:
        logger.error(f"Network error verifying Google ID token: {e}")
        raise ValueError("Could not connect to Google authentication service")


def create_customer_jwt(customer: Customer) -> str:
    """
    Creates a signed JWT for the customer with 30-day validity.
    """
    now = timezone.now()
    payload = {
        "sub": str(customer.id),
        "google_sub": customer.google_sub,
        "email": customer.email,
        "name": customer.name,
        "token_type": "customer",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=CUSTOMER_TOKEN_MAX_AGE)).timestamp())
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_customer_jwt(token: str) -> dict:
    """
    Decodes and validates the customer JWT.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("token_type") != "customer":
            raise exceptions.AuthenticationFailed("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise exceptions.AuthenticationFailed("Customer token has expired")
    except jwt.InvalidTokenError as e:
        raise exceptions.AuthenticationFailed(f"Invalid customer token: {e}")


def get_or_create_customer_from_google(google_info: dict) -> tuple[Customer, bool]:
    """
    Finds or creates a Customer record using Google user info.
    Updates name/avatar if changed.
    """
    sub = google_info['sub']
    email = google_info['email']
    name = google_info.get('name') or email.split('@')[0]
    picture = google_info.get('picture')

    customer, created = Customer.objects.get_or_create(
        google_sub=sub,
        defaults={
            'email': email,
            'name': name,
            'avatar_url': picture
        }
    )

    # If already existed, update avatar/name if missing
    updated = False
    if not created:
        if picture and customer.avatar_url != picture:
            customer.avatar_url = picture
            updated = True
        if name and customer.name != name:
            customer.name = name
            updated = True
        if updated:
            customer.save(update_fields=['avatar_url', 'name', 'updated_at'])

    return customer, created


class CustomerJWTAuthentication(BaseAuthentication):
    """
    DRF authentication class for customer shop endpoints.
    Reads token from `customer_token` cookie or `Authorization: Bearer <token>`.
    Sets `request.user` to the authenticated `Customer` instance.
    """
    def authenticate(self, request):
        token = None

        # 1. Check Authorization header
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        # 2. Check customer_token cookie
        if not token:
            token = request.COOKIES.get(CUSTOMER_TOKEN_COOKIE)

        if not token:
            return None

        try:
            payload = decode_customer_jwt(token)
            customer_id = payload.get('sub')
            customer = Customer.objects.get(id=customer_id)
            # Store customer instance on request for convenience
            request.customer = customer
            return (customer, token)
        except Customer.DoesNotExist:
            raise exceptions.AuthenticationFailed("Customer not found")
        except exceptions.AuthenticationFailed:
            raise
        except Exception as e:
            logger.warning(f"Error authenticating customer token: {e}")
            return None
