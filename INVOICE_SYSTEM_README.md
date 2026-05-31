# Invoice Generation & WhatsApp Delivery System

This system automatically generates professional invoice images from HTML/CSS templates and sends them to customers via WhatsApp when orders are created in the database.

## Features

✅ **Automatic Invoice Generation**
- Generates professional HTML/CSS invoice templates
- Converts to PNG images using Playwright
- Includes order details, customer info, pricing breakdown

✅ **Automatic WhatsApp Delivery**
- Sends invoice images automatically when orders are created
- Integrates with existing n8n WhatsApp delivery infrastructure
- Supports multi-customer batch sending

✅ **Flexible Configuration**
- Customizable company information (name, phone, email)
- Professional invoice styling with status indicators
- Support for multi-language addresses

✅ **Multiple Delivery Methods**
- Send via n8n WhatsApp webhook
- Fallback text message with image link
- Export invoices as downloadable PNG files

## Architecture

```
CustomerOrder Created
    ↓
[Signal Handler] handle_order_created_invoice
    ↓
[Invoice Service] generate_invoice_image
    ├─ Generate HTML from template
    └─ Convert to PNG using Playwright
    ↓
[Storage] upload_invoice_to_storage
    └─ Upload to MinIO/Default Storage
    ↓
[WhatsApp Service] send_invoice_via_whatsapp
    └─ Send via n8n webhook to customer
    ↓
✅ Customer receives invoice image
```

## How It Works

### 1. Signal Triggered on Order Creation

When a new `CustomerOrder` is created in the database, Django signals automatically:
- Detect the creation event
- Trigger the invoice generation pipeline
- Handle errors gracefully

### 2. Invoice Generation

The `invoice_service.py` generates a professional invoice with:
- Company branding information
- Order details and timeline
- Customer shipping information
- Item breakdown with quantities and pricing
- Tax calculation (5%)
- Professional styling and layout

**Template Includes:**
- Order ID and date
- Customer name, phone, email, address
- Product details with quantity and weight
- Itemized table with pricing
- Summary with subtotal, tax, and total
- Company contact information

### 3. Image Conversion

Uses **Playwright** to convert HTML to PNG:
- Headless Chromium browser
- A4-sized viewport (1000x1400px)
- High-quality PNG output
- Automatic temporary file management

### 4. Storage Upload

Uploads generated invoices to:
- **MinIO** (if configured)
- **Default Django storage backend**
- Organized in `/invoices/` directory
- Filename format: `invoices/order_{order_id}_{timestamp}.png`

### 5. WhatsApp Delivery

Sends via n8n webhook with:
- Customer's WhatsApp number
- Invoice image URL
- Order details in caption
- Professional message template

## Usage

### Automatic (On Order Creation)

Simply create a new order in the Django admin or via API:

```python
from users.models import CustomerOrder
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()

order = CustomerOrder.objects.create(
    user=user,
    customer_name="আহমেদ খান",
    phone_number="01725123456",
    address="ঢাকা, বাংলাদেশ",
    district="Dhaka",
    product_name="প্রিমিয়াম প্যাকেজ",
    price=5000.00,
    item_quantity=1,
    item_weight=1.5,
    status='pending'
)
# Invoice automatically generates and sends!
```

### Manual Generation via Management Command

```bash
# Send invoice for specific order
python manage.py send_invoices --order-id 123

# Send invoices for all pending orders
python manage.py send_invoices --all-pending

# Filter by customer name
python manage.py send_invoices --customer-name "Ahmed Khan"

# Filter by phone number
python manage.py send_invoices --phone "01725123456"

# Dry run (generate but don't send)
python manage.py send_invoices --order-id 123 --dry-run
```

### API Endpoints

#### Send Invoice for Specific Order

```bash
POST /api/orders/{order_id}/send_invoice/

Authorization: Bearer <token>

Response:
{
    "status": "success",
    "message": "Invoice sent to আহমেদ খান",
    "image_url": "https://storage.example.com/invoices/order_123_1234567890.png",
    "phone": "01725123456"
}
```

#### Download Invoice as File

```bash
GET /api/orders/{order_id}/get_invoice_image/

Authorization: Bearer <token> (optional)

Returns: PNG image file for download
Content-Disposition: attachment; filename="invoice_123.png"
```

#### List Orders for Current User

```bash
GET /api/orders/

Authorization: Bearer <token>

Response:
[
    {
        "id": 123,
        "customer_name": "আহমেদ খান",
        "phone_number": "01725123456",
        "address": "ঢাকা, বাংলাদেশ",
        "product_name": "প্রিমিয়াম প্যাকেজ",
        "price": "5000.00",
        "status": "pending",
        "created_at": "2026-05-30T10:30:00Z",
        ...
    }
]
```

#### Track Order by Phone Number

```bash
GET /api/orders/track/?phone=01725123456

Response:
[
    { order details... }
]
```

## API Integration Example

### JavaScript/Node.js

```javascript
// Send invoice for an order
async function sendInvoice(orderId, token) {
    const response = await fetch(`/api/orders/${orderId}/send_invoice/`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    
    const result = await response.json();
    if (result.status === 'success') {
        console.log('✅ Invoice sent:', result.message);
        console.log('📸 Image URL:', result.image_url);
    }
}

// Download invoice as file
async function downloadInvoice(orderId) {
    const response = await fetch(`/api/orders/${orderId}/get_invoice_image/`);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invoice_${orderId}.png`;
    a.click();
}
```

### Python

```python
import requests

# Send invoice
def send_order_invoice(order_id, token):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.post(
        f'http://localhost:8000/api/orders/{order_id}/send_invoice/',
        headers=headers
    )
    
    if response.status_code == 200:
        print("✅ Invoice sent successfully")
        print(response.json())
    else:
        print("❌ Error:", response.json())

# Download invoice
def download_order_invoice(order_id, filename='invoice.png'):
    response = requests.get(
        f'http://localhost:8000/api/orders/{order_id}/get_invoice_image/'
    )
    
    with open(filename, 'wb') as f:
        f.write(response.content)
    print(f"✅ Invoice downloaded: {filename}")
```

## Configuration

### Environment Variables

```env
# n8n WhatsApp Delivery Webhook
N8N_WHATSAPP_DELIVERY_URL=https://n8n.newsmartagent.com/webhook/whatsapp-delivery

# Company Information (used in invoice template)
COMPANY_NAME=NewsMarsh Agent
COMPANY_PHONE=+880-1234-567890
COMPANY_EMAIL=support@newsmarsh.com

# Storage Configuration
# Uses default Django storage (MinIO if configured)
AWS_STORAGE_BUCKET_NAME=newsmarsh-invoices
AWS_S3_REGION_NAME=us-east-1

# Playwright (automatic browser installation)
# Can use: chromium, firefox (requires playwright package)
```

### Django Settings

```python
# settings.py

# Invoice templates directory
INVOICE_TEMPLATE_DIR = os.path.join(BASE_DIR, 'templates', 'invoices')

# Temporary files for image generation
TEMP_FILES_DIR = os.path.join(BASE_DIR, 'tmp')

# Storage backend (MinIO or default)
STORAGES = {
    'default': {
        'BACKEND': 'minio_management.storages.MinioStorage',
        # or
        # 'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
}

# Logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
        'file': {
            'class': 'logging.FileHandler',
            'filename': 'logs/invoice.log',
        },
    },
    'loggers': {
        'users.services.invoice_service': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
        'users.services.whatsapp_invoice_service': {
            'handlers': ['console', 'file'],
            'level': 'INFO',
        },
    },
}
```

## File Structure

```
jwtauth/
├── users/
│   ├── models.py (CustomerOrder model)
│   ├── signals.py (Signal handlers for order creation)
│   ├── views.py (API endpoints)
│   ├── serializers.py (Serializers)
│   ├── management/
│   │   └── commands/
│   │       └── send_invoices.py (Management command)
│   └── services/
│       ├── invoice_service.py (Invoice generation)
│       └── whatsapp_invoice_service.py (WhatsApp delivery)
└── templates/
    └── invoices/
        └── invoice_template.html (Optional custom template)
```

## Logging

All invoice operations are logged:

```python
import logging
logger = logging.getLogger('users.services.invoice_service')

# Example log outputs:
# 📦 New order created: 123 for customer Ahmed Khan
# 🖼️ Generating invoice image for order 123...
# ☁️ Uploading invoice to storage...
# 📱 Sending invoice via WhatsApp to 01725123456...
# ✅ Invoice successfully sent to Ahmed Khan
```

View logs:

```bash
# View real-time logs
docker logs -f newsmartagent-django

# View invoice-specific logs
tail -f logs/invoice.log | grep "invoice"

# View WhatsApp delivery logs
tail -f logs/invoice.log | grep "WhatsApp"
```

## Error Handling

The system gracefully handles errors:

1. **Invoice Generation Fails**
   - Logs error and returns early
   - Prevents WhatsApp send attempt
   - Signal completes without crashing

2. **Storage Upload Fails**
   - Logs error
   - Attempts alternative delivery methods
   - Notifies admin if configured

3. **WhatsApp Send Fails**
   - Logs warning with order ID
   - Retries can be implemented via celery
   - Fallback to SMS notification

4. **Permission Errors**
   - Returns 403 Forbidden
   - Logs unauthorized access attempt
   - Admin-only override available

## Advanced Usage

### Custom Invoice Template

Create custom template in `templates/invoices/custom_invoice.html`:

```html
<!-- Your custom HTML template -->
<!-- Use {{ order.* }} to access order fields -->
```

Then modify `invoice_service.py`:

```python
def get_invoice_template(order):
    from django.template.loader import render_to_string
    
    html = render_to_string(
        'invoices/custom_invoice.html',
        {'order': order}
    )
    return html
```

### Batch Processing

Generate invoices for multiple orders:

```python
from users.models import CustomerOrder
from users.services.invoice_service import generate_invoice_image
from users.services.whatsapp_invoice_service import batch_send_invoices

# Get pending orders
pending_orders = CustomerOrder.objects.filter(status='pending')

# Process each order
invoices = []
for order in pending_orders:
    image_bytes, file_path = generate_invoice_image(order)
    image_url = upload_invoice_to_storage(image_bytes, order.id)
    invoices.append((order, image_url, image_bytes))

# Send batch
stats = batch_send_invoices(invoices)
print(f"Sent {stats['sent']}/{stats['total']} invoices")
```

### Celery Task (Optional)

For async processing:

```python
# tasks.py
from celery import shared_task
from users.services.invoice_service import generate_invoice_image

@shared_task
def process_order_invoice(order_id):
    from users.models import CustomerOrder
    
    order = CustomerOrder.objects.get(id=order_id)
    generate_invoice_image(order)
    return f"Invoice generated for order {order_id}"
```

## Troubleshooting

### Issue: Playwright Browser Download Error

```
Error: Browser download failed
```

**Solution:**
```bash
# Install Playwright browsers
playwright install chromium

# Or in Docker
RUN python -m playwright install chromium
```

### Issue: WhatsApp Delivery Returns 401

```
Status: 401 Unauthorized
```

**Solution:**
```bash
# Check n8n webhook URL
export N8N_WHATSAPP_DELIVERY_URL=https://your-n8n-instance.com/webhook/whatsapp-delivery

# Verify auth credentials in n8n webhook settings
```

### Issue: Images Not Uploading

```
Failed to upload invoice to storage
```

**Solution:**
```bash
# Check MinIO/Storage configuration
python manage.py shell

from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

# Test storage
test_file = default_storage.save('test.txt', ContentFile(b'test'))
print(default_storage.url(test_file))
```

### Issue: Signals Not Triggering

**Solution:**
```bash
# Verify signals are registered in apps.py
# Check INSTALLED_APPS includes 'users'

# Test signal in shell
python manage.py shell
from users.models import CustomerOrder
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.first()

order = CustomerOrder.objects.create(
    user=user,
    customer_name="Test",
    phone_number="01700000000",
    address="Test Address",
    price=1000.00
)
# Watch logs for signal execution
```

## Performance Tips

1. **Async Processing**: Use Celery for non-blocking invoice generation
2. **Caching**: Cache company information in settings
3. **Batch Sending**: Use `batch_send_invoices()` for multiple orders
4. **Image Compression**: Reduce PNG file size for faster delivery
5. **CDN**: Serve invoice images from CDN for faster downloads

## Security Considerations

✅ **Permission Checks**
- Only authenticated users can request invoices
- Users can only access their own orders
- Admin-only override available

✅ **Input Validation**
- Phone numbers validated before sending
- Order ID verified before processing
- File paths secured against traversal

✅ **Data Privacy**
- Invoice URLs expire after set time
- No sensitive data in URLs
- Encrypted storage credentials

✅ **Rate Limiting**
- Implement rate limits on API endpoints
- Prevent invoice spam/abuse
- Monitor for suspicious activity

## Support & Troubleshooting

1. Check logs: `tail -f logs/invoice.log`
2. Test manually: `python manage.py send_invoices --order-id 1 --dry-run`
3. Verify storage: `python manage.py shell` → test storage upload
4. Check WhatsApp: Verify n8n webhook is accessible
5. Debug API: Use Postman to test endpoints

## Future Enhancements

- [ ] Email invoice delivery
- [ ] SMS notification fallback
- [ ] Invoice PDF format
- [ ] Multiple language support
- [ ] Custom branding/logo
- [ ] Invoice templates per business
- [ ] Payment status integration
- [ ] Automatic retry mechanism
- [ ] Analytics dashboard
- [ ] Recurring invoice support

---

**Made with ❤️ for NewsMarsh Agent**
