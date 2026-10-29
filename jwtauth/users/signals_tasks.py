"""
Celery tasks for invoice generation and N8N delivery
Signal থেকে call হয় এই tasks
"""

import base64
import logging
import asyncio
from celery import shared_task
from django.utils import timezone
from users.models import CustomerOrder
from users.services.invoice_generator import InvoiceImageGenerator
from users.services.n8n_integration import N8NInvoiceDelivery

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def generate_and_send_invoice_async_task(self, order_id):
    """
    Celery task - Invoice generate করে N8N এর মাধ্যমে পাঠায়
    
    Args:
        order_id: CustomerOrder ID
    """
    
    try:
        order = CustomerOrder.objects.select_related('user').get(id=order_id)
        logger.info(f"🔄 Processing invoice for order #{order_id}")

        if order.invoice_sent:
            logger.info(f"⏹️ Invoice already sent for order #{order_id}, skipping duplicate delivery")
            return {'status': 'already_sent', 'order_id': order_id}
        
        # Ensure each item in items has image_url resolved
        raw_items = order.items if isinstance(order.items, list) else []
        enriched_items = []
        for itm in raw_items:
            if not isinstance(itm, dict):
                continue
            item_copy = dict(itm)
            if not item_copy.get('image_url'):
                try:
                    from datasheet.models import Product
                    prod = None
                    if item_copy.get('product_id'):
                        prod = Product.objects.filter(id=item_copy.get('product_id')).prefetch_related('gallery').first()
                    if not prod and item_copy.get('name'):
                        prod = Product.objects.filter(user=order.user, name__iexact=item_copy.get('name')).prefetch_related('gallery').first()
                        if not prod:
                            prod = Product.objects.filter(name__iexact=item_copy.get('name')).prefetch_related('gallery').first()
                    if prod:
                        if prod.gallery_images and isinstance(prod.gallery_images, list) and prod.gallery_images[0]:
                            item_copy['image_url'] = prod.gallery_images[0]
                        else:
                            gal = prod.gallery.filter(image__isnull=False).first()
                            if gal and gal.image:
                                item_copy['image_url'] = gal.image.url
                except Exception as img_err:
                    logger.warning(f"Could not resolve item image for invoice: {img_err}")
            enriched_items.append(item_copy)

        # Fallback single product image if items empty
        product_image_url = ''
        if not enriched_items and order.product_name:
            try:
                from datasheet.models import Product
                prod = Product.objects.filter(user=order.user, name__icontains=order.product_name.split(',')[0].strip()).prefetch_related('gallery').first()
                if not prod:
                    prod = Product.objects.filter(name__icontains=order.product_name.split(',')[0].strip()).prefetch_related('gallery').first()
                if prod:
                    if prod.gallery_images and isinstance(prod.gallery_images, list) and prod.gallery_images[0]:
                        product_image_url = prod.gallery_images[0]
                    else:
                        gal = prod.gallery.filter(image__isnull=False).first()
                        if gal and gal.image:
                            product_image_url = gal.image.url
            except Exception as pimg_err:
                logger.warning(f"Could not resolve single product image for invoice: {pimg_err}")

        # Build customer live tracking URL (Public tracking link on Customer Shop App)
        import os
        from django.conf import settings
        public_order_code = str(order.public_id) if getattr(order, 'public_id', None) else str(order.id)
        shop_domain = os.environ.get('SHOP_DOMAIN') or getattr(settings, 'SHOP_DOMAIN', 'shop.newsmartagent.com')
        tracking_url = f"https://{shop_domain}/orders/{public_order_code}"

        order_data = {
            'id': order.id,
            'public_id': public_order_code,
            'tracking_url': tracking_url,
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'address': order.address,
            'district': order.district or '',
            'upazila': order.upazila or '',
            'product_name': order.product_name or 'Product',
            'product_image_url': product_image_url,
            'price': float(order.price) if order.price else 0,
            'status': order.status,
            'created_at': order.created_at.isoformat() if order.created_at else '',
            'user_id': order.user_id,
            'source_platform': order.source_platform,
            'source_contact_id': order.source_contact_id,
            'item_quantity': order.item_quantity,
            'items': enriched_items,
        }
        
        try:
            fallback_name = order.user.email.split('@')[0] if order.user.email else None
            shop_name = (order.user.name.strip() if order.user.name and order.user.name.strip() else fallback_name) or "Smart Shop BD"
        except Exception:
            shop_name = "New Smart Agent Shop "

        # Step 1: Generate invoice image (Async via Playwright)
        image_base64 = asyncio.run(_generate_invoice_image_impl(order_data, shop_name, user_id=order.user_id))
        if not image_base64:
            logger.error(f"❌ Failed to generate invoice image for order #{order_id}")
            raise self.retry(countdown=120)

        # Step 2: Check platform & delivery needs (Sync Context)
        platform = order_data.get('source_platform') or 'web'
        sender_id = order_data.get('source_contact_id')

        # If web platform or no sender_id, skip delivery and mark processed
        if platform == 'web' or not sender_id:
            logger.info(f"⏭️ Skipping invoice delivery (platform={platform}, sender={sender_id})")
            order.invoice_sent = True
            order.invoice_sent_at = timezone.now()
            order.save(update_fields=['invoice_sent', 'invoice_sent_at'])
            return {'status': 'skipped_web', 'order_id': order_id}

        # Step 3: Deliver via platform in pure synchronous Django context
        logger.info(f"📤 Delivering invoice via {platform} to {sender_id}...")
        success = N8NInvoiceDelivery.send_to_n8n(
            platform=platform,
            sender_id=sender_id,
            image_base64=image_base64,
            order_data=order_data,
            message=""
        )

        # Handle special Baileys session-not-connected result
        if success == 'session_not_connected':
            logger.warning(f"⚠️ WhatsApp session not connected for order #{order_id}. Will not retry.")
            return {'status': 'waiting_for_whatsapp_session', 'order_id': order_id}

        if success:
            order.invoice_sent = True
            order.invoice_sent_at = timezone.now()
            order.save(update_fields=['invoice_sent', 'invoice_sent_at'])
            logger.info(f"✅ Invoice delivered successfully to {platform} for order #{order_id}")
            return {'status': 'success', 'order_id': order_id}
        else:
            logger.error(f"❌ Failed to send invoice for order #{order_id}")
            raise self.retry(countdown=120)
            
    except CustomerOrder.DoesNotExist:
        logger.error(f"Order #{order_id} not found")
        return {'status': 'error', 'message': 'Order not found'}
    except Exception as e:
        logger.error(f"❌ Error in invoice generation task: {e}", exc_info=True)
        raise self.retry(countdown=300, exc=e)


async def _generate_invoice_image_impl(order_data: dict, shop_name: str, user_id: int = None) -> str:
    """
    Async implementation - Playwright দিয়ে HTML invoice তৈরি করে Base64 ইমেজ রিটার্ন করে।
    
    Args:
        order_data: Prepared CustomerOrder data
        shop_name: Shop name for invoice header/footer
        user_id: User ID to fetch profile photo
    
    Returns:
        Base64 encoded PNG string or empty string on failure.
    """
    try:
        logger.info(f"📝 Generating invoice HTML for order #{order_data.get('id')}")
        
        # Profile photo URL
        profile_photo_url = None
        if user_id:
            try:
                from django.contrib.auth import get_user_model
                from asgiref.sync import sync_to_async
                User = get_user_model()
                user = await sync_to_async(lambda: User.objects.select_related('profile').filter(id=user_id).first())()
                if user and hasattr(user, 'profile') and user.profile.profile_photo:
                    profile_photo_url = user.profile.profile_photo.url
                    logger.info(f"✅ Profile photo found for user {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch profile photo: {e}")
        
        # HTML generate
        invoice_html = InvoiceImageGenerator.generate_invoice_html(
            order_data=order_data,
            shop_name=shop_name,
            profile_photo_url=profile_photo_url
        )
        
        logger.info(f"🖼️ Converting HTML to PNG image...")
        
        # Playwright HTML to image
        image_generator = InvoiceImageGenerator()
        await image_generator.initialize_browser()
        
        try:
            image_bytes = await image_generator.html_to_image(invoice_html, image_format='png')
        finally:
            await image_generator.close_browser()
        
        logger.info(f"✅ Image generated successfully ({len(image_bytes) / 1024:.2f} KB)")
        
        # Image to base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        return image_base64
        
    except Exception as e:
        logger.error(f"❌ Error in async invoice image generation: {e}", exc_info=True)
        return ""

