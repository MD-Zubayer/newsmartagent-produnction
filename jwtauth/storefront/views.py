import os
import logging
import re
from decimal import Decimal
from django.db.models import Count, Sum, Max, Q, F
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from users.models import CustomerOrder
from datasheet.models import Product
from datasheet.serializers import ProductSerializer
from users.authentication import CookieJWTAuthentication

from .models import Customer, CustomerIdentity, CustomerAddress, CheckoutSession, CustomerShopHistory, StorefrontPromotion
from .auth import (
    verify_google_id_token,
    get_or_create_customer_from_google,
    create_customer_jwt,
    CustomerJWTAuthentication,
    CUSTOMER_TOKEN_COOKIE,
    CUSTOMER_TOKEN_MAX_AGE
)
from .serializers import (
    CustomerSerializer,
    CustomerAddressSerializer,
    CheckoutSessionSerializer,
    CustomerOrderStorefrontSerializer,
    CustomerShopHistorySerializer,
    StorefrontPromotionSerializer
)
from .services.identity import (
    backfill_orders_for_customer,
    link_customer_to_checkout_session,
    get_customer_for_contact,
    is_ephemeral_customer,
    merge_customer_accounts,
    resolve_or_create_customer_for_session,
)
from .services.seller_history import remember_customer_shop
from .services.address_suggest import suggest_courier_areas, resolve_courier_mapping_for_address
from .services.delivery_quote import calculate_delivery_charge
from .services.phone_history import get_phone_delivery_profile
from .services.tracking import build_order_tracking_timeline
from .services.promotion_engine import (
    get_active_promotions_for_merchant,
    evaluate_order_promotions
)
from .tasks import send_checkout_order_confirmation_task, sync_platform_phone_history_task, sync_steadfast_phone_history_task
from .services.checkout_link import create_checkout_session, get_checkout_url
from courier.provider_registry import (
    active_provider_codes,
    locations as courier_locations,
    provider_specs_for_merchant,
    validate_selection as validate_courier_selection,
)

logger = logging.getLogger(__name__)


class SellerStorefrontProductsView(APIView):
    """Public, seller-scoped catalog exposed from a checkout link or general shop view."""
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('session') or request.query_params.get('session_code')
        merchant_id = request.query_params.get('merchant_id')

        session = None
        merchant = None

        if code:
            session = CheckoutSession.objects.filter(code=code).select_related('merchant').first()
            if session:
                merchant = session.merchant

        if not merchant and merchant_id:
            merchant = get_user_model().objects.filter(id=merchant_id, is_active=True).first()

        if not merchant and not session:
            # When browsing general shop, fetch all active products across active merchants
            products = Product.objects.filter(
                status='active', is_archived=False, user__is_active=True
            ).select_related('user', 'user__profile').prefetch_related('variants', 'gallery', 'image_asset_links__asset').order_by('-id')

            serialized = ProductSerializer(products, many=True, context={'request': request}).data
            public_fields = (
                'id', 'name', 'category', 'description', 'base_price', 'sale_price',
                'gallery', 'variants', 'attributes', 'warranty_information'
            )
            # Pre-fetch recent session codes for each merchant
            merchant_ids = list({p.user_id for p in products})
            recent_sessions = {}
            for s in CheckoutSession.objects.filter(merchant_id__in=merchant_ids).order_by('-created_at'):
                if s.merchant_id not in recent_sessions:
                    recent_sessions[s.merchant_id] = s.code

            catalog = []
            for idx, item in enumerate(serialized):
                prod_obj = products[idx]
                m = prod_obj.user
                prof = getattr(m, 'profile', None)
                s_name = getattr(prof, 'shop_name', None) or m.name or m.email.split('@')[0]
                s_avatar = ''
                if prof and getattr(prof, 'profile_photo', None):
                    try:
                        s_avatar = prof.profile_photo.url
                    except Exception:
                        s_avatar = ''

                s_info = {
                    'merchant_id': m.id,
                    'merchant_name': s_name,
                    'merchant_shop_name': getattr(prof, 'shop_name', '') or s_name,
                    'merchant_avatar': s_avatar,
                    'session_code': recent_sessions.get(m.id, ''),
                }

                p_data = {key: item.get(key) for key in public_fields}
                p_data['seller'] = s_info
                catalog.append(p_data)

            return Response(catalog)

        # Scoped to single merchant or session
        active_code = session.code if session else None
        if not active_code:
            merchant_session = CheckoutSession.objects.filter(merchant=merchant).order_by('-created_at').first()
            if merchant_session:
                active_code = merchant_session.code

        products = Product.objects.filter(
            user=merchant, status='active', is_archived=False
        ).prefetch_related('variants', 'gallery', 'image_asset_links__asset').order_by('-id')
        serialized = ProductSerializer(products, many=True, context={'request': request}).data
        
        # Profile & seller details
        profile = getattr(merchant, 'profile', None)
        seller_name = getattr(profile, 'shop_name', None) or merchant.name or merchant.email.split('@')[0]
        seller_avatar = ''
        if profile and getattr(profile, 'profile_photo', None):
            try:
                seller_avatar = profile.profile_photo.url
            except Exception:
                seller_avatar = ''

        seller_info = {
            'merchant_id': merchant.id,
            'merchant_name': seller_name,
            'merchant_shop_name': getattr(profile, 'shop_name', '') or seller_name,
            'merchant_avatar': seller_avatar,
            'session_code': active_code or '',
        }

        public_fields = (
            'id', 'name', 'category', 'description', 'base_price', 'sale_price',
            'gallery', 'variants', 'attributes', 'warranty_information'
        )
        catalog = []
        for item in serialized:
            p_data = {key: item.get(key) for key in public_fields}
            p_data['seller'] = seller_info
            catalog.append(p_data)

        response = Response(catalog)
        response['X-Merchant-Id'] = str(merchant.id)
        response['X-Session-Code'] = active_code or ''
        return response


class SellerStorefrontSessionView(APIView):
    """Create a fresh checkout session for an additional seller product."""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        source_code = request.data.get('session_code')
        merchant_id = request.data.get('merchant_id')

        source = None
        merchant = None

        if source_code:
            source = CheckoutSession.objects.filter(code=source_code).select_related('merchant', 'contact', 'agent').first()
            if source:
                merchant = source.merchant

        if not merchant and merchant_id:
            merchant = get_user_model().objects.filter(id=merchant_id, is_active=True).first()

        if not merchant:
            return Response({'error': 'Invalid checkout session or merchant'}, status=status.HTTP_400_BAD_REQUEST)

        requested = request.data.get('items') or []
        if not isinstance(requested, list) or not requested:
            return Response({'error': 'At least one product is required'}, status=status.HTTP_400_BAD_REQUEST)

        product_ids = []
        for raw in requested:
            try:
                product_ids.append(int(raw.get('product_id')))
            except (TypeError, ValueError, AttributeError):
                continue
        products = {
            product.id: product for product in Product.objects.filter(
                id__in=product_ids, user=merchant, status='active', is_archived=False
            ).prefetch_related('gallery', 'image_asset_links__asset')
        }

        items = []
        for raw in requested:
            try:
                product = products[int(raw.get('product_id'))]
                quantity = max(1, min(int(raw.get('quantity', 1)), 99))
            except (KeyError, TypeError, ValueError, AttributeError):
                continue
            price = product.sale_price if product.sale_price is not None else product.base_price
            image_url = ''
            if product.gallery_images and isinstance(product.gallery_images, list):
                image_url = product.gallery_images[0] or ''
            if not image_url:
                gallery = product.gallery.filter(image__isnull=False).first()
                if gallery and gallery.image:
                    image_url = gallery.image.url
            items.append({
                'product_id': product.id,
                'name': product.name,
                'quantity': quantity,
                'price': float(price or 0),
                'sku': product.base_sku,
                'image_url': image_url,
            })

        if not items:
            return Response({'error': 'No valid active products selected'}, status=status.HTTP_400_BAD_REQUEST)

        customer = request.user if isinstance(request.user, Customer) else (source.customer if source else None)

        # If an active source session exists and belongs to the same merchant and is still pending/active,
        # update the existing session directly so the customer keeps their checkout code and entered details.
        if source and source.merchant_id == merchant.id and source.status in ('pending', 'created'):
            source.items = items
            if customer and not source.customer:
                source.customer = customer
            source.save(update_fields=['items', 'customer', 'updated_at'] if customer else ['items', 'updated_at'])
            return Response({'success': True, 'code': source.code, 'url': get_checkout_url(source)}, status=status.HTTP_200_OK)

        session = create_checkout_session(
            merchant=merchant,
            agent=source.agent if source else None,
            contact=source.contact if source else None,
            items=items,
            source_platform=source.source_platform if source else 'web_shop',
            metadata={'customer_name': customer.name, 'phone': customer.primary_phone} if customer else {},
        )
        if customer:
            session.customer = customer
            session.save(update_fields=['customer', 'updated_at'])
        return Response({'success': True, 'code': session.code, 'url': get_checkout_url(session)}, status=status.HTTP_201_CREATED)


# ─── CUSTOMER AUTH VIEWS ──────────────────────────────────────────────────────

def _try_get_authenticated_customer(request):
    """Best-effort customer extraction from cookie or Authorization header on AllowAny endpoints."""
    if isinstance(getattr(request, 'user', None), Customer):
        return request.user
    try:
        auth_res = CustomerJWTAuthentication().authenticate(request)
        if auth_res and isinstance(auth_res[0], Customer):
            return auth_res[0]
    except Exception:
        pass
    return None


class GoogleAuthView(APIView):
    """
    POST /api/storefront/v1/auth/google/
    Verifies Google ID token from One Tap or button sign-in.
    Creates or updates Customer account, merges any existing ephemeral platform account,
    sets httpOnly cookie, and links checkout session.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        id_token = request.data.get('id_token')
        session_code = request.data.get('session_code')

        if not id_token:
            return Response({"error": "id_token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            google_info = verify_google_id_token(id_token)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        browser_customer = _try_get_authenticated_customer(request)
        session = CheckoutSession.objects.filter(code=session_code).first() if session_code else None
        session_customer = session.customer if session else None
        contact_customer = get_customer_for_contact(session.contact) if (session and session.contact) else None

        customer, created = get_or_create_customer_from_google(google_info)

        # Merge any ephemeral platform-created customer (from current browser or checkout session)
        # into the Google Customer account so all platform identities, addresses, and orders are unified.
        for prev_cust in {browser_customer, session_customer, contact_customer}:
            if prev_cust and prev_cust.id != customer.id:
                merge_customer_accounts(prev_cust, customer)

        # If arrived from a checkout link, associate session & contact
        if session:
            link_customer_to_checkout_session(customer, session)
            remember_customer_shop(customer, session.merchant)

        # Backfill any existing chat/phone orders for this customer
        backfill_orders_for_customer(customer)

        token = create_customer_jwt(customer)

        response = Response({
            "success": True,
            "created": created,
            "customer": CustomerSerializer(customer).data,
            "token": token
        }, status=status.HTTP_200_OK)

        # Set HTTP-only cookie on the shop domain
        response.set_cookie(
            key=CUSTOMER_TOKEN_COOKIE,
            value=token,
            max_age=CUSTOMER_TOKEN_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=True,
            path='/'
        )
        return response


class InstantSessionAuthView(APIView):
    """
    POST /api/storefront/v1/auth/instant/
    One-click instant authentication from a unique magic link (WhatsApp / Messenger / Instagram / Telegram).
    Creates or reuses a customer linked to the session and contact (or Google account if already linked),
    generates a customer JWT, and sets the auth cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        session_code = request.data.get('session_code')
        if not session_code:
            return Response({"error": "session_code is required"}, status=status.HTTP_400_BAD_REQUEST)

        session = CheckoutSession.objects.filter(code=session_code).first()
        if not session:
            try:
                session = CheckoutSession.objects.filter(id=session_code).first()
            except Exception:
                session = None

        if not session:
            if session_code == 'demo' or session_code.startswith('DEMO'):
                customer, _ = Customer.objects.get_or_create(
                    google_sub='instant_demo_user',
                    defaults={
                        'name': 'Demo Customer (AI Verified)',
                        'email': 'demo@customer.newsmartagent.com',
                        'primary_phone': '01700000000'
                    }
                )
                token = create_customer_jwt(customer)
                response = Response({
                    "success": True,
                    "customer": CustomerSerializer(customer).data,
                    "token": token,
                    "is_instant": True
                })
                response.set_cookie(
                    key=CUSTOMER_TOKEN_COOKIE,
                    value=token,
                    max_age=CUSTOMER_TOKEN_MAX_AGE,
                    httponly=True,
                    samesite='Lax',
                    secure=True,
                    path='/'
                )
                return response
            return Response({"error": "Invalid checkout session"}, status=status.HTTP_404_NOT_FOUND)

        browser_customer = _try_get_authenticated_customer(request)
        customer = resolve_or_create_customer_for_session(session, browser_customer=browser_customer)
        remember_customer_shop(customer, session.merchant)
        token = create_customer_jwt(customer)

        response = Response({
            "success": True,
            "customer": CustomerSerializer(customer).data,
            "token": token,
            "is_instant": is_ephemeral_customer(customer)
        })
        response.set_cookie(
            key=CUSTOMER_TOKEN_COOKIE,
            value=token,
            max_age=CUSTOMER_TOKEN_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=True,
            path='/'
        )
        return response


class CustomerMeView(APIView):
    """
    GET /api/storefront/v1/auth/me/
    PATCH /api/storefront/v1/auth/me/
    Returns or updates currently logged-in customer.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = CustomerSerializer(request.user)
        # Summary order stats
        orders_qs = CustomerOrder.objects.filter(customer=request.user)
        stats = {
            "total_orders": orders_qs.count(),
            "delivered_orders": orders_qs.filter(status='delivered').count(),
            "active_orders": orders_qs.filter(status__in=['pending', 'confirmed', 'shipped']).count(),
        }
        return Response({
            "customer": serializer.data,
            "stats": stats
        })

    def patch(self, request):
        customer = request.user
        name = request.data.get('name')
        phone = request.data.get('primary_phone')

        if name:
            customer.name = name
        if phone:
            customer.primary_phone = phone
            # When phone is set/updated, backfill orders with that phone
            backfill_orders_for_customer(customer, phone=phone)

        customer.save(update_fields=['name', 'primary_phone', 'updated_at'])
        return Response(CustomerSerializer(customer).data)


class CustomerLogoutView(APIView):
    """
    POST /api/storefront/v1/auth/logout/
    Clears customer authentication cookie.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        response = Response({"success": True, "message": "Logged out successfully"})
        response.delete_cookie(CUSTOMER_TOKEN_COOKIE, path='/')
        return response


class MerchantAvatarView(APIView):
    """Serve a fresh seller profile-image URL so cached shop logos do not expire."""
    permission_classes = [AllowAny]

    def get(self, request, merchant_id):
        merchant = get_object_or_404(
            get_user_model(),
            id=merchant_id,
        )
        profile = getattr(merchant, 'profile', None)
        photo = getattr(profile, 'profile_photo', None) if profile else None
        if not photo:
            return Response(status=status.HTTP_404_NOT_FOUND)
        from django.shortcuts import redirect
        return redirect(photo.url)


class CustomerShopHistoryView(APIView):
    """Return the authenticated customer's recently visited/ordered shops."""
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        history = CustomerShopHistory.objects.filter(
            customer=request.user
        ).select_related('merchant', 'merchant__profile')[:8]
        return Response(CustomerShopHistorySerializer(history, many=True).data)


# ─── CHECKOUT & SESSIONS ─────────────────────────────────────────────────────

class CheckoutSessionResolveView(APIView):
    """
    GET /api/storefront/v1/session/resolve/<code_or_id>/
    Resolves a checkout session by short code or UUID.
    Public view for landing page /c/[code] or /checkout/[session].
    """
    permission_classes = [AllowAny]

    def get(self, request, code):
        session = CheckoutSession.objects.filter(Q(code=code) | Q(id__startswith=code if len(code) > 8 else 'nomatch')).first()
        if not session:
            # Try UUID match if valid
            try:
                session = CheckoutSession.objects.filter(id=code).first()
            except Exception:
                pass

        if not session:
            return Response({"error": "Checkout session not found"}, status=status.HTTP_404_NOT_FOUND)

        if session.is_expired() and session.status == 'pending':
            session.status = 'expired'
            session.save(update_fields=['status', 'updated_at'])

        data = CheckoutSessionSerializer(session).data
        return Response(data)


class CheckoutSubmitView(APIView):
    """
    POST /api/storefront/v1/checkout/submit/
    Customer confirms their order.
    Creates CustomerOrder, links customer & session (auto-creating platform account if needed),
    and schedules courier/confirmation task.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        browser_customer = _try_get_authenticated_customer(request)
        data = request.data

        session_code = data.get('session_code')
        session = None
        if session_code:
            session = CheckoutSession.objects.filter(code=session_code).first()
            if not session and (session_code.startswith('test_') or session_code == 'demo'):
                session = CheckoutSession.objects.filter(code='demo').first()

        if not session:
            return Response({"error": "Invalid checkout session"}, status=status.HTTP_400_BAD_REQUEST)

        customer = resolve_or_create_customer_for_session(session, browser_customer=browser_customer)

        recipient_name = data.get('recipient_name') or (customer.name if customer else '')
        phone = data.get('phone') or (customer.primary_phone if customer else '')
        full_address = data.get('full_address')
        district = data.get('district')
        upazila = data.get('upazila')
        items = data.get('items')
        special_instruction = data.get('special_instruction', '')
        save_address = data.get('save_address', True)
        selected_courier_ids = data.get('courier_location_ids') or {}
        requested_courier_provider = (data.get('courier_provider') or '').strip().lower()

        if not phone or not full_address:
            return Response({"error": "Phone and full address are required"}, status=status.HTTP_400_BAD_REQUEST)

        if session.status == 'completed':
            if session.code == 'demo' or (session_code and session_code.startswith('test_')):
                session.status = 'pending'
                session.save(update_fields=['status'])
            else:
                return Response({"error": "This checkout session has already been completed"}, status=status.HTTP_400_BAD_REQUEST)

        merchant = session.merchant

        # Keep chat identity attached even when account creation preceded form submission.
        link_customer_to_checkout_session(customer, session)

        # Items & Subtotal
        order_items = items if items is not None else session.items
        subtotal = Decimal('0.00')
        product_names = []
        for itm in order_items:
            qty = int(itm.get('quantity', 1))
            price = Decimal(str(itm.get('price', 0)))
            subtotal += price * qty
            product_names.append(itm.get('name', 'Product'))

        # Prefer the customer-selected, seller-scoped courier IDs. Fuzzy matching
        # remains only as a backward-compatible fallback.
        courier_res = None
        if isinstance(selected_courier_ids, dict):
            # Each provider owns its IDs and parent-child validation. Never
            # validate a Pathao ID against another provider's table.
            provider_candidates = ([requested_courier_provider] if requested_courier_provider else []) + [
                code for code in active_provider_codes(merchant) if code != requested_courier_provider
            ]
            for provider in provider_candidates:
                selection = selected_courier_ids.get(provider)
                if validate_courier_selection(merchant, provider, selection):
                    courier_res = {
                        'district': district or '',
                        'upazila': upazila or '',
                        'courier_location_ids': selected_courier_ids,
                    }
                    break
        if courier_res is None:
            courier_res = resolve_courier_mapping_for_address(full_address, district, upazila)
        resolved_district = courier_res.get('district') or district or ''
        resolved_upazila = courier_res.get('upazila') or upazila or ''
        courier_ids = courier_res.get('courier_location_ids', {})

        # Calculate live delivery charge & promotions
        profile = getattr(merchant, 'profile', None)
        merchant_default_courier = (getattr(profile, 'default_courier_provider', 'steadfast') or 'steadfast').strip().lower()
        quote_provider = requested_courier_provider
        if not quote_provider:
            quote_provider = next((code for code in active_provider_codes(merchant) if validate_courier_selection(merchant, code, courier_ids.get(code))), None)
        if not quote_provider:
            active_codes = active_provider_codes(merchant)
            quote_provider = merchant_default_courier if merchant_default_courier in active_codes else (active_codes[0] if active_codes else None)

        coupon_code = (data.get('coupon_code') or '').strip().upper()
        item_count = sum(int(itm.get('quantity', 1)) for itm in order_items)
        promo_eval = evaluate_order_promotions(
            merchant=merchant,
            subtotal=float(subtotal),
            item_count=item_count,
            items=order_items,
            district=resolved_district,
            coupon_code=coupon_code,
        )

        quote = calculate_delivery_charge(
            merchant,
            resolved_district,
            courier_ids,
            courier_provider=quote_provider,
            subtotal=float(subtotal),
            items=order_items,
            coupon_code=coupon_code,
        )
        delivery_charge = quote.get('delivery_charge', Decimal('100.00'))
        if promo_eval.get('free_delivery'):
            delivery_charge = Decimal('0.00')
        discount_amt = Decimal(str(promo_eval.get('total_discount', 0.0)))
        final_price = max(Decimal('0.00'), subtotal - discount_amt)

        if coupon_code and promo_eval.get('coupon_result', {}).get('is_valid'):
            StorefrontPromotion.objects.filter(merchant=merchant, coupon_code__iexact=coupon_code).update(times_used=F('times_used') + 1)

        # Determine courier provider
        courier_provider = 'manual'
        pathao_info = courier_ids.get('pathao') or {}
        selected_provider_info = {}
        provider_candidates = ([requested_courier_provider] if requested_courier_provider else []) + [
            code for code in active_provider_codes(merchant) if code != requested_courier_provider
        ]
        for candidate in provider_candidates:
            if validate_courier_selection(merchant, candidate, courier_ids.get(candidate)):
                courier_provider = candidate
                selected_provider_info = courier_ids.get(candidate) or {}
                break
        if courier_provider == 'manual':
            active_codes = active_provider_codes(merchant)
            if requested_courier_provider and requested_courier_provider in active_codes:
                courier_provider = requested_courier_provider
            elif merchant_default_courier in active_codes:
                courier_provider = merchant_default_courier
            elif active_codes:
                courier_provider = active_codes[0]
        order_location_info = selected_provider_info or courier_ids.get(courier_provider) or pathao_info


        # Create CustomerOrder
        order = CustomerOrder.objects.create(
            user=merchant,
            customer=customer,
            contact=session.contact,
            checkout_session=session,
            customer_name=recipient_name,
            phone_number=phone,
            address=full_address,
            district=resolved_district,
            upazila=resolved_upazila,
            product_name=", ".join(product_names)[:250],
            items=order_items,
            price=final_price,
            delivery_charge=delivery_charge,
            cod_charge=quote.get('cod_charge', Decimal('0.00')),
            cod_bearer=quote.get('cod_bearer', 'seller'),
            courier=courier_provider,
            status='pending',
            call_status='calling',
            # Keep the channel that created the checkout session so the existing
            # invoice signal can deliver back to WhatsApp/Messenger/etc.
            source_platform=(
                session.source_platform
                or (session.contact.platform if session.contact else None)
                or 'shop'
            ),
            source_contact_id=session.contact.identifier if session.contact else None,
            city_id=str(order_location_info.get('city_id') or ''),
            zone_id=str(order_location_info.get('zone_id') or ''),
            area_id=str(order_location_info.get('area_id') or ''),
            special_instruction=special_instruction
        )

        # Mark session completed
        session.status = 'completed'
        session.customer = customer
        session.save(update_fields=['status', 'customer', 'updated_at'])

        # Clear temporary order draft fields from UserMemory while preserving permanent profile
        try:
            from aiAgent.models import UserMemory
            if session.contact:
                contact_mem = UserMemory.objects.filter(ai_agent=session.contact.agent, sender_id=session.contact.identifier).first()
                if contact_mem and isinstance(contact_mem.data, dict):
                    m_data = dict(contact_mem.data)
                    m_internal = dict(m_data.get('_internal') or {})
                    m_internal['order_fields'] = {}
                    m_internal['order_state'] = 'idle'
                    from storefront.services.checkout_link import get_shop_base_url
                    tracking_url = f"{get_shop_base_url()}/orders/{order.public_id}"
                    m_internal['last_confirmed_order'] = {
                        'order_id': order.id,
                        'public_id': str(order.public_id),
                        'tracking_url': tracking_url,
                        'product_name': order.product_name,
                        'items': order.items or [{'name': order.product_name, 'quantity': order.item_quantity, 'price': float(order.price or 0)}],
                        'item_quantity': order.item_quantity,
                        'price': float(order.price or 0),
                        'created_at': order.created_at.isoformat() if order.created_at else None
                    }
                    m_data['_internal'] = m_internal
                    contact_mem.data = m_data
                    contact_mem.save(update_fields=['data'])
                    logger.info(f"Cleaned up order_fields buffer for contact {session.contact.identifier} after Order #{order.id}")
        except Exception as mem_err:
            logger.warning(f"Failed to reset UserMemory draft after checkout order creation: {mem_err}")

        remember_customer_shop(customer, merchant, increment_order=True)

        # Save customer primary phone if not set
        if not customer.primary_phone:
            customer.primary_phone = phone
            customer.save(update_fields=['primary_phone', 'updated_at'])

        backfill_orders_for_customer(customer, contact=session.contact, phone=phone)

        # Save address if requested
        if save_address:
            CustomerAddress.objects.update_or_create(
                customer=customer,
                full_address=full_address,
                defaults={
                    'recipient_name': recipient_name,
                    'phone': phone,
                    'district': resolved_district,
                    'upazila': resolved_upazila,
                    'courier_location_ids': courier_ids,
                    'is_default': True
                }
            )

        # Phone history analysis in background
        sync_platform_phone_history_task.delay(phone, merchant.id)
        sync_steadfast_phone_history_task.delay(phone, merchant.id)

        token = create_customer_jwt(customer)
        response = Response({
            "success": True,
            "order": CustomerOrderStorefrontSerializer(order).data,
            "public_id": str(order.public_id),
            "order_id": order.id,
            "customer": CustomerSerializer(customer).data,
            "token": token,
        }, status=status.HTTP_201_CREATED)
        response.set_cookie(
            key=CUSTOMER_TOKEN_COOKIE,
            value=token,
            max_age=CUSTOMER_TOKEN_MAX_AGE,
            httponly=True,
            samesite='Lax',
            secure=True,
            path='/'
        )
        return response


# ─── ORDERS & TRACKING ───────────────────────────────────────────────────────

class CustomerOrdersListView(APIView):
    """
    GET /api/storefront/v1/orders/
    Returns list of orders for the authenticated customer across all shops.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        status_filter = request.query_params.get('status')
        qs = CustomerOrder.objects.filter(customer=request.user).select_related('user', 'user__profile').order_by('-created_at')

        if status_filter:
            if status_filter == 'active':
                qs = qs.filter(status__in=['pending', 'confirmed', 'shipped'])
            elif status_filter == 'delivered':
                qs = qs.filter(status='delivered')
            elif status_filter == 'cancelled':
                qs = qs.filter(status__in=['cancelled', 'returned'])
            else:
                qs = qs.filter(status=status_filter)

        serializer = CustomerOrderStorefrontSerializer(qs[:50], many=True)
        return Response(serializer.data)


class CustomerOrderDetailView(APIView):
    """
    GET /api/storefront/v1/orders/<public_id_or_id>/
    Returns order details with real-time tracking timeline.
    Accessible publicly via UUID public_id or to owner by ID.
    """
    permission_classes = [AllowAny]

    def get(self, request, identifier):
        order = None
        clean_id = (identifier or '').strip().lstrip('#')

        # Try public_id first (UUID)
        try:
            order = CustomerOrder.objects.select_related('user', 'user__profile').get(public_id=clean_id)
        except Exception:
            pass

        if not order and clean_id.isdigit():
            # If numeric ID, check by order ID
            order = CustomerOrder.objects.select_related('user', 'user__profile').filter(id=int(clean_id)).first()

        # If not found and looks like phone number
        if not order and clean_id.isdigit() and len(clean_id) >= 10:
            order = CustomerOrder.objects.select_related('user', 'user__profile').filter(phone_number__endswith=clean_id[-10:]).order_by('-created_at').first()

        if not order:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(CustomerOrderStorefrontSerializer(order).data)


class CustomerOrderVoiceActionView(APIView):
    """
    POST /api/storefront/v1/orders/<identifier>/voice-action/
    Handles Interactive Voice Confirmation actions from Web Call / Phone Call:
    - action = "1" or "confirm": Confirms order and triggers auto-courier booking if enabled by merchant.
    - action = "2" or "cancel": Cancels order with reason.
    - action = "3" or "support": Requests human customer care callback / handoff.
    """
    permission_classes = [AllowAny]

    def post(self, request, identifier):
        clean_id = (identifier or '').strip().lstrip('#')
        order = None
        try:
            order = CustomerOrder.objects.select_related('user', 'user__profile').get(public_id=clean_id)
        except Exception:
            if clean_id.isdigit():
                order = CustomerOrder.objects.select_related('user', 'user__profile').filter(id=int(clean_id)).first()

        if not order:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        action = str(request.data.get('action') or '').strip().lower()
        now = timezone.now()

        if action in ('1', 'confirm', 'confirmed'):
            order.call_status = 'confirmed'
            order.call_confirmed_at = now
            order.status = 'confirmed'
            order.save(update_fields=['call_status', 'call_confirmed_at', 'status', 'updated_at'])

            # Send order confirmation notification/invoice to customer channel
            try:
                send_checkout_order_confirmation_task.delay(order.id)
            except Exception as task_err:
                logger.warning(f"Failed to dispatch send_checkout_order_confirmation_task for order {order.id}: {task_err}")

            # Send N8N Playwright Invoice image to WhatsApp/Messenger if not already sent
            try:
                from users.signals_tasks import generate_and_send_invoice_async_task
                dispatched = CustomerOrder.objects.filter(id=order.id, invoice_task_dispatched=False).update(invoice_task_dispatched=True)
                if dispatched or not order.invoice_sent:
                    generate_and_send_invoice_async_task.delay(order.id)
                    logger.info(f"🚀 Dispatched invoice image task for confirmed order #{order.id}")
            except Exception as inv_err:
                logger.warning(f"Failed to dispatch generate_and_send_invoice_async_task for order {order.id}: {inv_err}")

            # Trigger auto-courier dispatch if enabled
            from courier.services.auto_dispatcher import attempt_auto_courier_booking
            courier_res = attempt_auto_courier_booking(order)

            return Response({
                "success": True,
                "action": "confirmed",
                "message": "অর্ডারটি সফলভাবে নিশ্চিত করা হয়েছে!",
                "courier_dispatch": courier_res,
                "order": CustomerOrderStorefrontSerializer(order).data,
            }, status=status.HTTP_200_OK)

        elif action in ('2', 'cancel', 'cancelled'):
            order.call_status = 'cancelled'
            order.status = 'cancelled'
            order.call_notes = request.data.get('reason') or 'Cancelled via AI Voice Call confirmation'
            order.save(update_fields=['call_status', 'status', 'call_notes', 'updated_at'])

            return Response({
                "success": True,
                "action": "cancelled",
                "message": "আপনার অনুরোধ অনুযায়ী অর্ডারটি বাতিল করা হয়েছে।",
                "order": CustomerOrderStorefrontSerializer(order).data,
            }, status=status.HTTP_200_OK)

        elif action in ('3', 'support', 'human'):
            order.call_status = 'human_requested'
            order.call_notes = 'Customer requested human support call via IVR'
            order.save(update_fields=['call_status', 'call_notes', 'updated_at'])

            return Response({
                "success": True,
                "action": "human_requested",
                "message": "আমাদের কাস্টমার কেয়ার প্রতিনিধি খুব শীঘ্রই আপনার সাথে যোগাযোগ করবেন।",
                "order": CustomerOrderStorefrontSerializer(order).data,
            }, status=status.HTTP_200_OK)

        elif action in ('timeout', 'decline', 'declined', 'end', 'missed', 'unverified'):
            # The customer declined the call or hung up without pressing 1
            # Strictly maintain status='pending' and mark call_status='unverified_call'
            order.call_status = 'unverified_call'
            order.status = 'pending'
            order.call_notes = 'Customer hung up or did not confirm via voice call. Requires manual confirmation.'
            order.save(update_fields=['call_status', 'status', 'call_notes', 'updated_at'])

            return Response({
                "success": True,
                "action": "unverified",
                "message": "আপনার অর্ডারটি গৃহীত হয়েছে। আমাদের প্রতিনিধি দ্রুত কল করে নিশ্চিত করবেন।",
                "order": CustomerOrderStorefrontSerializer(order).data,
            }, status=status.HTTP_200_OK)

        return Response({"error": "Invalid action code. Supported: 1 (confirm), 2 (cancel), 3 (support), timeout/decline"}, status=status.HTTP_400_BAD_REQUEST)


class CustomerOrderCancelView(APIView):
    """
    POST /api/storefront/v1/orders/<identifier>/cancel/
    Allows customer to cancel order if it hasn't been shipped yet.
    """
    permission_classes = [AllowAny]

    def post(self, request, identifier):
        clean_id = (identifier or '').strip().lstrip('#')
        order = None
        try:
            order = CustomerOrder.objects.select_related('user').get(public_id=clean_id)
        except Exception:
            if clean_id.isdigit():
                order = CustomerOrder.objects.select_related('user').filter(id=int(clean_id)).first()

        if not order:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        # Allow cancel only if in pending, confirmed, processing, or ready_to_ship
        non_cancellable_statuses = ['shipped', 'delivered', 'cancelled', 'returned']
        if str(order.status).lower() in non_cancellable_statuses:
            return Response({
                "error": f"অর্ডারটি ইতিমধ্যে '{order.status}' অবস্থায় থাকায় সরাসরি বাতিল করা সম্ভব নয়। অনুগ্রহ করে মার্চেন্ট সাপোর্টে যোগাযোগ করুন।"
            }, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason') or 'কাস্টমার কর্তৃক বাতিল'
        order.status = 'cancelled'
        current_notes = order.special_instruction or ''
        order.special_instruction = f"{current_notes}\n[Customer Cancellation Reason]: {reason}".strip()
        order.save(update_fields=['status', 'special_instruction', 'updated_at'])

        # Notify merchant via in-app notification if available
        try:
            from users.models import Notification
            Notification.objects.create(
                user=order.user,
                title="অর্ডার বাতিল হয়েছে",
                message=f"কাস্টমার {order.customer_name} (#{order.id}) অর্ডারটি বাতিল করেছেন। কারণ: {reason}",
                type="order_cancelled"
            )
        except Exception:
            pass

        return Response({
            "success": True,
            "message": "অর্ডারটি সফলভাবে বাতিল করা হয়েছে।",
            "order": CustomerOrderStorefrontSerializer(order).data
        })


class CustomerOrderEditAddressView(APIView):
    """
    PATCH /api/storefront/v1/orders/<identifier>/edit-address/
    Allows customer to update address/phone before shipment.
    """
    permission_classes = [AllowAny]

    def patch(self, request, identifier):
        clean_id = (identifier or '').strip().lstrip('#')
        order = None
        try:
            order = CustomerOrder.objects.select_related('user').get(public_id=clean_id)
        except Exception:
            if clean_id.isdigit():
                order = CustomerOrder.objects.select_related('user').filter(id=int(clean_id)).first()

        if not order:
            return Response({"error": "Order not found"}, status=status.HTTP_404_NOT_FOUND)

        if str(order.status).lower() in ['shipped', 'delivered', 'cancelled', 'returned']:
            return Response({
                "error": "অর্ডারটি ইতিমধ্যে ডেলিভারি প্রক্রিয়ায় চলে যাওয়ায় ঠিকানা পরিবর্তন সম্ভব নয়।"
            }, status=status.HTTP_400_BAD_REQUEST)

        new_name = request.data.get('customer_name')
        new_phone = request.data.get('phone_number')
        new_address = request.data.get('address')
        new_district = request.data.get('district')
        new_upazila = request.data.get('upazila')

        updated_fields = ['updated_at']
        if new_name:
            order.customer_name = str(new_name).strip()
            updated_fields.append('customer_name')
        if new_phone:
            order.phone_number = str(new_phone).strip()
            updated_fields.append('phone_number')
        if new_address:
            order.address = str(new_address).strip()
            updated_fields.append('address')
        if new_district:
            order.district = str(new_district).strip()
            updated_fields.append('district')
        if new_upazila:
            order.upazila = str(new_upazila).strip()
            updated_fields.append('upazila')

        order.save(update_fields=updated_fields)

        return Response({
            "success": True,
            "message": "ডেলিভারি ঠিকানা সফলভাবে আপডেট করা হয়েছে।",
            "order": CustomerOrderStorefrontSerializer(order).data
        })


# ─── ADDRESSES ───────────────────────────────────────────────────────────────

class CustomerAddressesView(APIView):
    """
    GET /api/storefront/v1/addresses/
    POST /api/storefront/v1/addresses/
    Manages customer delivery addresses.
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        addresses = CustomerAddress.objects.filter(customer=request.user)
        return Response(CustomerAddressSerializer(addresses, many=True).data)

    def post(self, request):
        data = request.data
        full_address = data.get('full_address')
        recipient_name = data.get('recipient_name') or request.user.name
        phone = data.get('phone') or request.user.primary_phone
        district = data.get('district')
        upazila = data.get('upazila')
        is_default = data.get('is_default', False)

        if not full_address or not phone:
            return Response({"error": "full_address and phone are required"}, status=status.HTTP_400_BAD_REQUEST)

        # Resolve courier location IDs
        courier_res = resolve_courier_mapping_for_address(full_address, district, upazila)

        address = CustomerAddress.objects.create(
            customer=request.user,
            recipient_name=recipient_name,
            phone=phone,
            full_address=full_address,
            district=courier_res.get('district') or district or '',
            upazila=courier_res.get('upazila') or upazila or '',
            courier_location_ids=courier_res.get('courier_location_ids', {}),
            is_default=is_default
        )
        return Response(CustomerAddressSerializer(address).data, status=status.HTTP_201_CREATED)


class CustomerAddressDetailView(APIView):
    """
    PATCH /api/storefront/v1/addresses/<id>/
    DELETE /api/storefront/v1/addresses/<id>/
    """
    authentication_classes = [CustomerJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        address = get_object_or_404(CustomerAddress, id=pk, customer=request.user)
        serializer = CustomerAddressSerializer(address, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        address = get_object_or_404(CustomerAddress, id=pk, customer=request.user)
        address.delete()
        return Response({"success": True}, status=status.HTTP_204_NO_CONTENT)


class CourierProviderOptionsView(APIView):
    """Return only the seller's active courier providers and their schemas."""
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('session') or request.query_params.get('session_code')
        merchant_id = request.query_params.get('merchant_id')
        merchant = None
        if code:
            session = CheckoutSession.objects.filter(code=code).select_related('merchant').first()
            if session:
                merchant = session.merchant
        if not merchant and merchant_id and str(merchant_id).isdigit():
            merchant = get_user_model().objects.filter(id=int(merchant_id), is_active=True).first()
        if not merchant:
            return Response({'enabled': False, 'providers': [], 'error': 'Invalid checkout session or merchant'}, status=status.HTTP_404_NOT_FOUND)
        providers = provider_specs_for_merchant(merchant)
        profile = getattr(merchant, 'profile', None)
        default_provider = (getattr(profile, 'default_courier_provider', 'steadfast') or 'steadfast').strip().lower()
        # Ensure default_provider matches an active provider if possible
        active_codes = [p['code'] for p in providers]
        if default_provider not in active_codes and active_codes:
            default_provider = active_codes[0]
            
        return Response({
            'enabled': bool(providers),
            'providers': providers,
            'default_provider': default_provider,
            'source': 'seller_config'
        })


class CourierLocationOptionsView(APIView):
    """Return locations using the selected provider's own hierarchy."""
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.query_params.get('session') or request.query_params.get('session_code')
        provider = (request.query_params.get('provider') or 'pathao').lower()
        level = (request.query_params.get('level') or 'city').lower().rstrip('s')
        parent_id = request.query_params.get('parent_id')
        
        # If no session code is passed (e.g. from customer profile / addresses tab), allow global location lookup
        if not code:
            values = courier_locations(provider, level, parent_id)
            return Response({'enabled': True, 'provider': provider, 'level': level, 'locations': values, 'source': 'global_locations'})

        session = CheckoutSession.objects.filter(code=code).select_related('merchant').first()
        if not session:
            # Fallback to general location hierarchy instead of erroring out
            values = courier_locations(provider, level, parent_id)
            return Response({'enabled': True, 'provider': provider, 'level': level, 'locations': values, 'source': 'fallback_locations'})

        if provider not in active_provider_codes(session.merchant):
            return Response({'enabled': False, 'locations': [], 'error': 'Courier is not active for this seller'}, status=status.HTTP_403_FORBIDDEN)
        values = courier_locations(provider, level, parent_id)
        return Response({'enabled': True, 'provider': provider, 'level': level, 'locations': values, 'source': 'local_sync'})


# ─── UTILITY / SMART CHECKOUT APIS ──────────────────────────────────────────

class CourierSuggestView(APIView):
    """
    GET /api/storefront/v1/courier/suggest-address/?q=...
    Address autocomplete for Pathao/Steadfast areas.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        suggestions = suggest_courier_areas(q)
        return Response(suggestions)


class DeliveryQuoteView(APIView):
    """
    POST /api/storefront/v1/courier/quote/
    Calculates estimated delivery charge and applies real-time promotion benefits.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        district = request.data.get("district")
        courier_ids = request.data.get("courier_ids", {})
        courier_provider = request.data.get("courier_provider")
        session_code = request.data.get("session_code")
        merchant_id = request.data.get("merchant_id")
        session = CheckoutSession.objects.filter(code=session_code).select_related("merchant").first() if session_code else None
        merchant = session.merchant if session else None
        if not merchant and merchant_id and str(merchant_id).isdigit():
            merchant = get_user_model().objects.filter(id=int(merchant_id), is_active=True).first()
        weight = float(request.data.get("weight", 0.5))
        subtotal = float(request.data.get("subtotal") or 0.0)
        items = request.data.get("items") or []
        coupon_code = request.data.get("coupon_code")

        quote = calculate_delivery_charge(
            merchant=merchant,
            district=district,
            courier_ids=courier_ids,
            item_weight=weight,
            courier_provider=courier_provider,
            subtotal=subtotal,
            items=items,
            coupon_code=coupon_code,
        )

        item_count = sum(int(i.get('quantity', 1)) for i in items) if items else 1
        promo_eval = evaluate_order_promotions(
            merchant=merchant,
            subtotal=subtotal,
            item_count=item_count,
            items=items,
            district=district,
            coupon_code=coupon_code,
        )
        quote["promotion_evaluation"] = promo_eval
        return Response(quote)


class PhoneHistoryView(APIView):
    """
    GET /api/storefront/v1/phone-history/?phone=...
    Checks delivery success rate badge for phone number.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        phone = request.query_params.get('phone', '')
        merchant = None
        session_code = request.query_params.get('session')
        if session_code:
            session = CheckoutSession.objects.filter(code=session_code).select_related('merchant').first()
            merchant = session.merchant if session else None
        profile = get_phone_delivery_profile(phone, merchant=merchant)
        return Response(profile)


class OpenGraphSessionView(APIView):
    """
    GET /api/storefront/v1/og/<code_or_id>/
    Returns dynamic OpenGraph metadata for rich preview cards (Baileys/WhatsApp/Messenger).
    """
    permission_classes = [AllowAny]

    def get(self, request, code):
        session = CheckoutSession.objects.filter(code=code).select_related('merchant', 'merchant__profile').first()
        if not session:
            return Response({"error": "Session not found"}, status=status.HTTP_404_NOT_FOUND)

        shop_name = getattr(session.merchant.profile, 'shop_name', None) if hasattr(session.merchant, 'profile') else None
        shop_name = shop_name or session.merchant.name or "New Smart Agent Shop"

        items = session.items or []
        first_item = items[0] if items else {}
        first_image = first_item.get('image_url') or getattr(session.merchant.profile, 'image', None)

        # Resolve product image from catalog if not directly in session item
        if not first_image and first_item.get('name'):
            try:
                from datasheet.models import Product
                prod_name = first_item.get('name', '').strip()
                prod = Product.objects.filter(user=session.merchant, name__iexact=prod_name).first()
                if not prod:
                    prod = Product.objects.filter(user=session.merchant, name__icontains=prod_name[:25]).first()
                if prod:
                    if prod.gallery_images and isinstance(prod.gallery_images, list) and len(prod.gallery_images) > 0:
                        first_image = prod.gallery_images[0]
                    if not first_image:
                        gal = prod.gallery.filter(image__isnull=False).first()
                        if gal and gal.image:
                            first_image = gal.image.url
                    if not first_image:
                        link = prod.image_asset_links.select_related('asset').first()
                        if link and link.asset and link.asset.image:
                            first_image = link.asset.image.url
            except Exception as e:
                logger.warning(f"Error resolving product catalog image: {e}")

        # Ensure image_url is an absolute HTTPS URL
        shop_domain = os.environ.get('SHOP_DOMAIN') or getattr(settings, 'SHOP_DOMAIN', 'shop-dev.newsmartagent.com')
        image_url_str = ""
        if first_image:
            image_url_str = str(first_image)
            if image_url_str.startswith('/'):
                image_url_str = f"https://{shop_domain}{image_url_str}"
        else:
            image_url_str = f"https://{shop_domain}/logo.png"

        # Item names for preview title
        item_names = ", ".join([it.get('name') for it in items if it.get('name')])
        if item_names:
            title = f"🛒 {item_names} — {shop_name}"
        else:
            title = f"🛒 {shop_name} থেকে অর্ডার কনফার্ম করুন"

        description = f"মোট প্রদেয় মূল্য: ৳{session.total_price} | ১-ক্লিকে ক্যাশ অন ডেলিভারিতে অর্ডার নিশ্চিত করুন"

        return Response({
            "title": title,
            "description": description,
            "shop_name": shop_name,
            "image_url": image_url_str,
            "total_price": float(session.total_price),
            "currency": session.currency,
            "item_count": len(items)
        })


# ─── MERCHANT DASHBOARD CUSTOMERS ────────────────────────────────────────────

class MerchantCustomerListView(APIView):
    """
    GET /api/storefront/v1/merchant/customers/
    Used by merchant dashboard -> Customers page.
    Returns customers who ordered from this merchant, along with order stats and linked platforms.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = request.user
        search = request.query_params.get('search', '').strip()

        # Query orders belonging to this merchant that have a customer or customer_name
        orders_qs = CustomerOrder.objects.filter(user=merchant)

        if search:
            orders_qs = orders_qs.filter(
                Q(customer_name__icontains=search) |
                Q(phone_number__icontains=search) |
                Q(customer__name__icontains=search) |
                Q(customer__email__icontains=search)
            )

        # 1. Collect registered customers
        customer_ids = orders_qs.filter(customer__isnull=False).values_list('customer_id', flat=True).distinct()
        registered_customers = Customer.objects.filter(id__in=customer_ids).prefetch_related('identities')

        results = []
        handled_phones = set()

        for cust in registered_customers:
            cust_orders = CustomerOrder.objects.filter(user=merchant, customer=cust)
            total_orders = cust_orders.count()
            total_spent = cust_orders.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
            last_order = cust_orders.order_by('-created_at').first()
            delivered = cust_orders.filter(status='delivered').count()
            returned = cust_orders.filter(status='returned').count()

            decided = delivered + returned
            success_rate = int(round((delivered / decided) * 100)) if decided > 0 else (100 if delivered > 0 else None)

            phone = cust.primary_phone or (last_order.phone_number if last_order else "")
            if phone:
                handled_phones.add(re.sub(r'\D', '', phone)[-10:])

            # Multi-courier reputation
            reputation = get_phone_delivery_profile(phone, merchant=merchant) if phone else None

            # Platforms used by this customer
            platforms = list(cust.identities.values_list('platform', flat=True).distinct())
            if not platforms:
                order_platforms = list(cust_orders.values_list('source_platform', flat=True).distinct())
                platforms = [p for p in order_platforms if p]

            results.append({
                "id": str(cust.id),
                "is_registered": True,
                "name": cust.name,
                "email": cust.email,
                "avatar_url": cust.avatar_url,
                "phone": phone,
                "linked_platforms": platforms,
                "total_orders": total_orders,
                "total_spent": float(total_spent),
                "last_order_date": last_order.created_at.isoformat() if last_order else None,
                "last_order_status": last_order.status if last_order else None,
                "delivery_success_rate": success_rate,
                "courier_reputation": reputation
            })

        # 2. Collect guest / phone-only orders not bound to registered Customer
        guest_orders = orders_qs.filter(customer__isnull=True).exclude(phone_number__isnull=True).exclude(phone_number='')
        guest_phone_list = guest_orders.values_list('phone_number', flat=True).distinct()

        for g_phone in guest_phone_list:
            clean_digits = re.sub(r'\D', '', str(g_phone))[-10:]
            if clean_digits in handled_phones:
                continue
            handled_phones.add(clean_digits)

            matching_orders = CustomerOrder.objects.filter(user=merchant, phone_number__icontains=clean_digits)
            total_orders = matching_orders.count()
            total_spent = matching_orders.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
            last_order = matching_orders.order_by('-created_at').first()
            delivered = matching_orders.filter(status='delivered').count()
            returned = matching_orders.filter(status='returned').count()

            decided = delivered + returned
            success_rate = int(round((delivered / decided) * 100)) if decided > 0 else (100 if delivered > 0 else None)

            # Platforms
            order_platforms = list(matching_orders.values_list('source_platform', flat=True).distinct())
            platforms = [p for p in order_platforms if p]

            # Multi-courier reputation
            reputation = get_phone_delivery_profile(g_phone, merchant=merchant)

            results.append({
                "id": f"phone_{clean_digits}",
                "is_registered": False,
                "name": last_order.customer_name if last_order else f"Guest ({clean_digits[-4:]})",
                "email": "",
                "avatar_url": None,
                "phone": g_phone,
                "linked_platforms": platforms,
                "total_orders": total_orders,
                "total_spent": float(total_spent),
                "last_order_date": last_order.created_at.isoformat() if last_order else None,
                "last_order_status": last_order.status if last_order else None,
                "delivery_success_rate": success_rate,
                "courier_reputation": reputation
            })

        # Sort by total_orders descending
        results.sort(key=lambda x: x['total_orders'], reverse=True)

        return Response({
            "count": len(results),
            "results": results
        })


class MerchantCustomerDetailView(APIView):
    """
    GET /api/storefront/v1/merchant/customers/<customer_id>/
    Returns detailed profile, addresses, orders, and multi-courier reputation for a single customer.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request, customer_id):
        merchant = request.user
        
        # Check if guest customer (phone-based)
        if str(customer_id).startswith("phone_"):
            clean_digits = str(customer_id).replace("phone_", "")
            orders = CustomerOrder.objects.filter(user=merchant, phone_number__icontains=clean_digits).order_by('-created_at')
            last_order = orders.first()
            phone = last_order.phone_number if last_order else clean_digits
            total_spent = orders.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
            reputation = get_phone_delivery_profile(phone, merchant=merchant)
            
            customer_data = {
                "id": customer_id,
                "name": last_order.customer_name if last_order else "Guest Customer",
                "email": "",
                "primary_phone": phone,
                "avatar_url": None,
                "created_at": last_order.created_at.isoformat() if last_order else None,
            }
            
            return Response({
                "customer": customer_data,
                "total_orders": orders.count(),
                "total_spent": float(total_spent),
                "orders": CustomerOrderStorefrontSerializer(orders, many=True).data,
                "addresses": [],
                "identities": [],
                "courier_reputation": reputation
            })

        customer = get_object_or_404(Customer, id=customer_id)

        orders = CustomerOrder.objects.filter(user=merchant, customer=customer).order_by('-created_at')
        addresses = CustomerAddress.objects.filter(customer=customer)
        identities = CustomerIdentity.objects.filter(customer=customer)

        total_spent = orders.aggregate(total=Sum('price'))['total'] or Decimal('0.00')
        last_order = orders.first()
        phone = customer.primary_phone or (last_order.phone_number if last_order else "")
        reputation = get_phone_delivery_profile(phone, merchant=merchant) if phone else None

        return Response({
            "customer": CustomerSerializer(customer).data,
            "total_orders": orders.count(),
            "total_spent": float(total_spent),
            "orders": CustomerOrderStorefrontSerializer(orders, many=True).data,
            "addresses": CustomerAddressSerializer(addresses, many=True).data,
            "identities": list(identities.values('platform', 'platform_user_id', 'display_name', 'created_at')),
            "courier_reputation": reputation
        })


class StorefrontPromotionsListView(APIView):
    """
    GET /api/storefront/v1/promotions/?merchant_id=...
    Public endpoint returning active promotions and campaigns for a shop.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        merchant_id = request.query_params.get('merchant_id')
        merchant = None
        if merchant_id and str(merchant_id).isdigit():
            merchant = get_user_model().objects.filter(id=int(merchant_id), is_active=True).first()
        if not merchant:
            return Response([])

        active_promos = get_active_promotions_for_merchant(merchant)
        serializer = StorefrontPromotionSerializer(active_promos, many=True)
        return Response(serializer.data)


class StorefrontPromotionManageView(APIView):
    """
    GET, POST, PUT, DELETE /api/storefront/v1/merchant/promotions/
    Seller management view for active & scheduled promotions.
    """
    authentication_classes = [CookieJWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = request.user
        promos = StorefrontPromotion.objects.filter(merchant=merchant).prefetch_related('applicable_products__gallery', 'applicable_products__image_asset_links__asset').order_by('-created_at')
        serializer = StorefrontPromotionSerializer(promos, many=True)
        return Response(serializer.data)

    def post(self, request):
        merchant = request.user
        serializer = StorefrontPromotionSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(merchant=merchant)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request):
        merchant = request.user
        promo_id = request.data.get('id')
        promo = get_object_or_404(StorefrontPromotion, id=promo_id, merchant=merchant)
        serializer = StorefrontPromotionSerializer(promo, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        merchant = request.user
        promo_id = request.query_params.get('id') or request.data.get('id')
        promo = get_object_or_404(StorefrontPromotion, id=promo_id, merchant=merchant)
        promo.delete()
        return Response({"status": "deleted", "id": promo_id})


class ValidateCouponView(APIView):
    """
    POST /api/storefront/v1/coupons/validate/
    Validates a coupon code against a merchant and cart subtotal.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        merchant_id = request.data.get('merchant_id')
        coupon_code = request.data.get('coupon_code')
        subtotal = float(request.data.get('subtotal') or 0.0)
        items = request.data.get('items') or []
        district = request.data.get('district', '')

        merchant = None
        if merchant_id and str(merchant_id).isdigit():
            merchant = get_user_model().objects.filter(id=int(merchant_id), is_active=True).first()

        item_count = sum(int(i.get('quantity', 1)) for i in items) if items else 1
        promo_eval = evaluate_order_promotions(
            merchant=merchant,
            subtotal=subtotal,
            item_count=item_count,
            items=items,
            district=district,
            coupon_code=coupon_code,
        )
        return Response(promo_eval.get('coupon_result') or {"is_valid": False, "message": "কুপন পাওয়া যায়নি।"})


class MerchantAutomationSettingsView(APIView):
    """
    GET, POST /api/storefront/v1/merchant/automation-settings/
    Allows authenticated merchants to view and update their automation and voice preferences:
    - auto_courier_booking: bool
    - default_courier_provider: str ('steadfast' | 'pathao')
    - ai_voice_enabled: bool
    - voice_preference: str ('auto' | 'seller_upload' | 'ai_generated' | 'default_audio')
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = getattr(user, 'profile', None)
        default_voice_url = ""
        if profile and getattr(profile, 'default_voice_audio', None):
            try:
                default_voice_url = profile.default_voice_audio.url
            except Exception:
                default_voice_url = ""

        return Response({
            "auto_courier_booking": getattr(profile, 'auto_courier_booking', False) if profile else False,
            "default_courier_provider": getattr(profile, 'default_courier_provider', 'steadfast') if profile else 'steadfast',
            "ai_voice_enabled": getattr(profile, 'ai_voice_enabled', False) if profile else False,
            "voice_preference": getattr(profile, 'voice_preference', 'auto') if profile else 'auto',
            "default_voice_audio_url": default_voice_url,
            "word_balance": getattr(user, 'word_balance', 0),
        })

    def post(self, request):
        user = request.user
        profile = getattr(user, 'profile', None)
        if not profile:
            return Response({"error": "Profile not found"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        updated_fields = []

        if 'auto_courier_booking' in data:
            profile.auto_courier_booking = str(data['auto_courier_booking']).lower() in ('true', '1')
            updated_fields.append('auto_courier_booking')

        if 'default_courier_provider' in data:
            provider = str(data['default_courier_provider']).strip().lower()
            if provider in ('steadfast', 'pathao'):
                profile.default_courier_provider = provider
                updated_fields.append('default_courier_provider')

        if 'ai_voice_enabled' in data:
            profile.ai_voice_enabled = str(data['ai_voice_enabled']).lower() in ('true', '1')
            updated_fields.append('ai_voice_enabled')

        if 'voice_preference' in data:
            v_pref = str(data['voice_preference']).strip().lower()
            if v_pref in ('auto', 'seller_upload', 'ai_generated', 'default_audio'):
                profile.voice_preference = v_pref
                updated_fields.append('voice_preference')

        # Handle shop default voice audio file upload / delete
        if 'default_voice_audio' in request.FILES:
            profile.default_voice_audio = request.FILES['default_voice_audio']
            updated_fields.append('default_voice_audio')
        elif data.get('remove_default_voice') in (True, 'true', '1'):
            profile.default_voice_audio = None
            updated_fields.append('default_voice_audio')

        if updated_fields:
            profile.save(update_fields=updated_fields)

        default_voice_url = ""
        voice_audio = getattr(profile, 'default_voice_audio', None)
        if voice_audio:
            try:
                default_voice_url = voice_audio.url
            except Exception:
                default_voice_url = ""

        return Response({
            "success": True,
            "message": "Automation settings updated successfully.",
            "auto_courier_booking": profile.auto_courier_booking,
            "default_courier_provider": profile.default_courier_provider,
            "ai_voice_enabled": profile.ai_voice_enabled,
            "voice_preference": profile.voice_preference,
            "default_voice_audio_url": default_voice_url,
            "word_balance": getattr(user, 'word_balance', 0),
        })

