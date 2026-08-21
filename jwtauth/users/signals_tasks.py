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
        
        order_data = {
            'id': order.id,
            'customer_name': order.customer_name,
            'phone_number': order.phone_number,
            'address': order.address,
            'district': order.district or '',
            'upazila': order.upazila or '',
            'product_name': order.product_name or 'Product',
            'price': float(order.price) if order.price else 0,
            'status': order.status,
            'created_at': order.created_at.isoformat() if order.created_at else '',
            'user_id': order.user_id,
            'source_platform': order.source_platform,
            'source_contact_id': order.source_contact_id,
            'item_quantity': order.item_quantity,
            'items': order.items,
        }
        
        try:
            fallback_name = order.user.email.split('@')[0] if order.user.email else None
            shop_name = (order.user.name.strip() if order.user.name and order.user.name.strip() else fallback_name) or "Smart Shop BD"
        except Exception:
            shop_name = "New Smart Agent Shop "
        
        # Run async invoice generation with user_id for profile photo
        success = asyncio.run(_generate_and_send_invoice_impl(order_data, shop_name, user_id=order.user_id))
        
        # Handle special Baileys session-not-connected result
        if success == 'session_not_connected':
            logger.warning(f"⚠️ WhatsApp session not connected for order #{order_id}. Will not retry.")
            return {'status': 'waiting_for_whatsapp_session', 'order_id': order_id}

        if success:
            order.invoice_sent = True
            order.invoice_sent_at = timezone.now()
            order.save(update_fields=['invoice_sent', 'invoice_sent_at'])
            logger.info(f"✅ Invoice sent successfully for order #{order_id}")
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


async def _generate_and_send_invoice_impl(order_data: dict, shop_name: str, user_id: int = None) -> bool:
    """
    Async implementation - Invoice generate করে N8N এ পাঠায়
    
    Args:
        order_data: Prepared CustomerOrder data
        shop_name: Shop name for invoice header/footer
        user_id: User ID to fetch profile photo
    
    Returns:
        Success status
    """
    
    try:
        logger.info(f"📝 Generating invoice HTML for order #{order_data.get('id')}")
        
        # Get profile photo URL from user
        profile_photo_url = None
        if user_id:
            try:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                user = User.objects.select_related('profile').get(id=user_id)
                if user.profile.profile_photo:
                    profile_photo_url = user.profile.profile_photo.url
                    logger.info(f"✅ Profile photo found for user {user_id}")
            except Exception as e:
                logger.warning(f"⚠️ Could not fetch profile photo: {e}")
        
        # २. Invoice HTML generate করো
        invoice_html = InvoiceImageGenerator.generate_invoice_html(
            order_data=order_data,
            shop_name=shop_name,
            profile_photo_url=profile_photo_url
        )
        
        logger.info(f"🖼️ Converting HTML to PNG image...")
        
        # ३. Playwright দিয়ে HTML কে image এ convert করো
        image_generator = InvoiceImageGenerator()
        await image_generator.initialize_browser()
        
        try:
            image_bytes = await image_generator.html_to_image(invoice_html, image_format='png')
        finally:
            await image_generator.close_browser()
        
        logger.info(f"✅ Image generated successfully ({len(image_bytes) / 1024:.2f} KB)")
        
        # ४. Image কে base64 এ convert করো (N8N এর জন্য)
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        logger.info(f"✅ Base64 encoded ({len(image_base64) / 1024:.2f} KB)")
        
        # ५. Platform check করো
        platform = order_data.get('source_platform') or 'web'
        sender_id = order_data.get('source_contact_id')
        
        logger.info(f"📤 Ready to deliver via {platform} to {sender_id}")
        
        # ६. যদি web platform হয় বা sender_id নেই, তবে skip করো
        if platform == 'web' or not sender_id:
            logger.info(f"⏭️  Skipping N8N delivery (platform={platform}, sender={sender_id})")
            logger.info(f"   💡 Invoice was generated but not delivered (web form)")
            return True
        
        # ७. N8N webhook call করো
        logger.info(f"📤 Calling N8N webhook...")
        success = N8NInvoiceDelivery.send_to_n8n(
            platform=platform,
            sender_id=sender_id,
            image_base64=image_base64,
            order_data=order_data,
            message="আপনার অর্ডার ইনভয়েস এখানে 📋\n\nYour order invoice is attached below 📋"
        )
        
        if success:
            logger.info(f"✅ Invoice delivered to {platform} for customer {order_data.get('customer_name')}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error in async invoice generation: {e}", exc_info=True)
        return False
