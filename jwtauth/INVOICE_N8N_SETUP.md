# ═══════════════════════════════════════════════════════════════════════════════
# INVOICE & N8N INTEGRATION CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════
# 
# আপনার .env.prod এ নিচের variables যোগ করুন
#

# N8N কে আপনার messaging platforms এর সাথে connect করার জন্য webhook URLs
# প্রতিটি platform এর জন্য আলাদা N8N workflow থাকবে যা invoice image পাবে এবং send করবে

# Example N8N Webhook URLs (আপনার N8N instance এর URL ব্লকে পরিবর্তন করুন)

N8N_WHATSAPP_WEBHOOK=https://your-n8n-instance.com/webhook/invoice/whatsapp
N8N_MESSENGER_WEBHOOK=https://your-n8n-instance.com/webhook/invoice/messenger
N8N_INSTAGRAM_WEBHOOK=https://your-n8n-instance.com/webhook/invoice/instagram
N8N_TELEGRAM_WEBHOOK=https://your-n8n-instance.com/webhook/invoice/telegram
N8N_FACEBOOK_WEBHOOK=https://your-n8n-instance.com/webhook/invoice/facebook

# PlayWright browser configuration (Optional)
PLAYWRIGHT_LAUNCH_ARGS=--no-sandbox,--disable-setuid-sandbox

# ═══════════════════════════════════════════════════════════════════════════════
# HOW IT WORKS - কীভাবে কাজ করে
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. CUSTOMER ORDER CREATED - গ্রাহক order করে
#    └─ NextJS form → Django API (OrderSubmitView)
#       └─ CustomerOrder model save হয়
#
# 2. SIGNAL TRIGGER - Django signal post_save trigger হয়
#    └─ users/signals.py → handle_order_created_invoice_n8n()
#       └─ Celery task queue এ add করে (async)
#
# 3. ASYNC INVOICE GENERATION - Celery worker process করে
#    └─ users/signals_tasks.py → generate_and_send_invoice_async_task()
#       ├─ Invoice HTML generate (orders/page.jsx style HTML)
#       ├─ Playwright দিয়ে HTML → PNG image convert
#       ├─ Image কে base64 encode করে
#       └─ N8N webhook এ POST request করে (payload এ image base64 থাকবে)
#
# 4. N8N WEBHOOK RECEIVES - N8N workflow receive করে image
#    └─ N8N workflow structure:
#       ├─ Webhook trigger (POST receiver)
#       ├─ Platform detect (WhatsApp/Messenger/Instagram/Telegram)
#       ├─ Image download/process করে
#       └─ Platform specific API দিয়ে customer এ পাঠায়
#
# 5. CUSTOMER RECEIVES - গ্রাহক platform এ invoice পায়
#    └─ WhatsApp: Media message with image
#    └─ Messenger: Attachment image
#    └─ Instagram: Direct message image
#    └─ Telegram: Photo message
#

# ═══════════════════════════════════════════════════════════════════════════════
# N8N WORKFLOW EXAMPLE - WhatsApp এর জন্য N8N workflow
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. HTTP Trigger
#    - Method: POST
#    - Path: /invoice/whatsapp
#    - Authentication: None (or optional)
#
# 2. Code node (process base64 image)
#    ```javascript
#    // base64 কে buffer এ convert করো
#    const imageBase64 = $input.first().json.media.base64;
#    const imageBuffer = Buffer.from(imageBase64, 'base64');
#    
#    // File node এ save করতে পারো অথবা directly send করতে পারো
#    return {
#      image: imageBuffer,
#      jid: $input.first().json.jid,
#      caption: $input.first().json.message,
#    };
#    ```
#
# 3. WhatsApp API node (Baileys থেকে)
#    - Send message প্রতিটি platform এর জন্য
#    - Include image as media
#    - Add caption
#
# একই pattern সব platforms এর জন্য (শুধু API endpoints আলাদা)
#

# ═══════════════════════════════════════════════════════════════════════════════
# DJANGO SIDE SETUP
# ═══════════════════════════════════════════════════════════════════════════════
#
# settings.py এ এই lines add করুন:
#
# ```python
# # Invoice & N8N Configuration
# N8N_WHATSAPP_WEBHOOK = os.getenv('N8N_WHATSAPP_WEBHOOK', '')
# N8N_MESSENGER_WEBHOOK = os.getenv('N8N_MESSENGER_WEBHOOK', '')
# N8N_INSTAGRAM_WEBHOOK = os.getenv('N8N_INSTAGRAM_WEBHOOK', '')
# N8N_TELEGRAM_WEBHOOK = os.getenv('N8N_TELEGRAM_WEBHOOK', '')
# N8N_FACEBOOK_WEBHOOK = os.getenv('N8N_FACEBOOK_WEBHOOK', '')
#
# # Celery configuration (for async tasks)
# CELERY_BROKER_URL = 'redis://localhost:6379/0'
# CELERY_RESULT_BACKEND = 'redis://localhost:6379/0'
# CELERY_ACCEPT_CONTENT = ['json']
# CELERY_TASK_SERIALIZER = 'json'
# 
# # Playwright configuration (optional)
# PLAYWRIGHT_LAUNCH_ARGS = os.getenv('PLAYWRIGHT_LAUNCH_ARGS', '').split(',')
# ```
#
# settings/celery.py এ:
# ```python
# from celery import Celery
# import os
#
# os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'settings.settings')
# app = Celery('newsmartagent')
# app.config_from_object('django.conf:settings', namespace='CELERY')
# app.autodiscover_tasks()
# ```
#

# ═══════════════════════════════════════════════════════════════════════════════
# FRONTEND - ORDER FORM MODIFICATION
# ═══════════════════════════════════════════════════════════════════════════════
#
# nextjs/app/(main)/orders/page.jsx এ order form থেকে order submit করার সময:
#
# ```javascript
# const handleSubmitOrder = async (formData) => {
#   // Form data prepare করো
#   const orderPayload = {
#     ...formData,
#     form_id: formId,
#     source_platform: 'web', // যদি web form থেকে আসলে
#     // অথবা যদি messaging platform থেকে redirect হয়ে আসে:
#     source_platform: sessionStorage.getItem('platform') || 'web',
#     source_contact_id: sessionStorage.getItem('sender_id') || null,
#   };
#
#   const response = await api.post('/orders/', orderPayload);
#   
#   // Order successfully created, signal trigger হবে automatically
# };
# ```
#

# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE MIGRATION
# ═══════════════════════════════════════════════════════════════════════════════
#
# Run migration:
# python manage.py migrate
#
# (CustomerOrder model এ source_platform এবং source_contact_id fields যুক্ত হয়েছে)
#

# ═══════════════════════════════════════════════════════════════════════════════
# FILE STRUCTURE
# ═══════════════════════════════════════════════════════════════════════════════
#
# users/
#   ├─ models.py                      (CustomerOrder updated with platform fields)
#   ├─ signals.py                     (handle_order_created_invoice_n8n signal)
#   ├─ signals_tasks.py               (Celery task for invoice generation)
#   └─ services/
#       ├─ invoice_generator.py       (InvoiceImageGenerator using Playwright)
#       └─ n8n_integration.py         (N8N webhook integration)
#
# aiAgent/
#   └─ signals.py                     (cleaned up, no invoice code now)
#

# ═══════════════════════════════════════════════════════════════════════════════
# TESTING
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. Test order creation via API:
#    POST /api/orders/
#    {
#      "customer_name": "John Doe",
#      "phone_number": "+8801712345678",
#      "address": "123 Main Street",
#      "district": "Dhaka",
#      "product_name": "Product",
#      "price": "100.00",
#      "source_platform": "whatsapp",
#      "source_contact_id": "8801712345678@s.whatsapp.net"
#    }
#
# 2. Check Celery worker logs:
#    celery -A settings worker -l info
#
# 3. Check N8N webhook:
#    N8N logs দেখুন webhook receive হচ্ছে কিনা
#

# ═══════════════════════════════════════════════════════════════════════════════
# TROUBLESHOOTING
# ═══════════════════════════════════════════════════════════════════════════════
#
# Issue: Invoice not generated
#   → Check if Celery worker is running
#   → Check Django logs for signal handler errors
#   → Check if Playwright browser is available
#
# Issue: N8N webhook not receiving data
#   → Check N8N webhook URL in .env
#   → Check N8N logs
#   → Verify network connectivity from Django to N8N
#
# Issue: Image is not sending to customer
#   → Check if platform and source_contact_id are correct in database
#   → Check N8N workflow configuration
#   → Check messaging platform API credentials in N8N
#
