# PLATFORM-RESTRICTED IMAGE DELIVERY SYSTEM
# 🖼️ Complete Integration Guide

## 📋 Sistema Overview

This system delivers product images to messaging platforms with strict platform-specific access control:

- **Only presigned URLs**: Images accessible only via temporary signed URLs (60s expiry)
- **Platform verification**: Each platform gets ONLY images it requested
- **Smart captions**: Captions shown ONLY when user asks for details (price, stock, offer, features)
- **Supported platforms**: WhatsApp, Messenger, Instagram, Telegram, TikTok

## 🏗️ Architecture

```
User (on Platform) 
  ↓ (Message with image request)
WebHook Handler 
  ↓ (Call AI Agent API)
AI Agent (Gemini with Tools)
  ├─ Analyze user query (wants details or just images?)
  ├─ Call Tool: get_product_images_with_presigned_urls
  │   └─ Platform verification
  │   └─ MinIO presigned URL generation
  │   └─ Caption extraction (if applicable)
  ├─ Format response
  └─ Call Platform Router
      └─ Route to WhatsApp/Messenger/Telegram/etc sender
          └─ Send image(s) with/without caption
```

## 🔧 Components

### 1. Django View: RowImagePresignedURLView
**File**: `jwtauth/datasheet/views.py` (lines ~615-800)
**Endpoint**: `GET /datasheet/spreadsheets/<sheet_id>/row-image-presigned-url/`

**Parameters**:
```python
{
    "row_index": 2,           # Row containing images
    "platform": "whatsapp",   # Requesting platform (required)
    "limit": 3                # Max images to return
}
```

**Response**:
```json
{
    "presigned_urls": [
        {
            "url": "https://minio-domain/.../...?X-Amz-Signature=...",
            "caption": "Product XYZ",
            "position": 0,
            "image_id": 123
        }
    ],
    "platform": "whatsapp",
    "expires_in": 60,
    "caller_info": {
        "platform": "whatsapp",
        "user_id": 1,
        "timestamp": "2026-03-06T...",
        "ip": "..."
    }
}
```

### 2. AI Tool: ImageDeliveryTool
**File**: `jwtauth/aiAgent/image_delivery_tools.py`

**Function Definition**:
```python
{
    "name": "get_product_images_with_presigned_urls",
    "description": "Fetch product images with platform-specific access control",
    "parameters": {
        "properties": {
            "row_index": {"type": "integer"},
            "platform": {"type": "string", "enum": ["whatsapp", "messenger", "instagram", "telegram", "tiktok"]},
            "limit": {"type": "integer", "default": 3}
        },
        "required": ["row_index", "platform"]
    }
}
```

**Execution**: `execute_image_delivery_tool(user_id, sheet_id, tool_params, agent_config)`

### 3. Caption Handler: QueryAnalyzer
**File**: `jwtauth/aiAgent/caption_handler.py`

**Logic**:
- Analyzes user message for keywords (দাম, price, স্টক, stock, etc.)
- Returns: `wants_details: bool`, `detail_type: str`, `detail_level: str`

**Example**:
```python
analyzer = QueryAnalyzer("আমার দাম কত? এবং স্টক আছে?")
analysis = analyzer.analyze()
# Result: {
#     'wants_details': True,
#     'detail_type': 'price',
#     'detail_level': 'with_caption',
#     'confidence': 0.95
# }
```

### 4. Gemini Integration: generate_gemini_reply_with_tools
**File**: `jwtauth/aiAgent/gemini.py` (new function at end)

**Signature**:
```python
generate_gemini_reply_with_tools(
    prompt,                      # System prompt
    history,                     # Chat history
    current_message,             # User's message
    agent_config,                # AgentAI object
    user_id,                     # For image tool
    sheet_id,                    # Spreadsheet ID
    platform,                    # Requesting platform
    enable_image_tool=True       # Enable image delivery tool
)
```

**Handles**:
- Function calls from Gemini
- Executes image delivery tool
- Formats images for response
- Includes captions only if user asked

### 5. Platform Router: platform_image_router.py
**File**: `jwtauth/aiAgent/platform_image_router.py`

**Usage**:
```python
from aiAgent.platform_image_router import route_images

route_images(
    platform='whatsapp',
    recipient_id='+1234567890',
    image_urls=['https://...presigned...'],
    captions=['Product XYZ'],
    agent_config=agent_config,
    message_text="Here are the product images!"
)
```

**Supported platforms**:
- WhatsApp: Uses `send_whatsapp_message()`
- Telegram: Uses `send_telegram_message()`
- Instagram, Messenger, TikTok: Placeholder implementations

## 🚀 Integration Steps

### Step 1: Update Webhook Handler
In your WhatsApp/Telegram webhook handler, call:

```python
from aiAgent.gemini import generate_gemini_reply_with_tools
from aiAgent.caption_handler import QueryAnalyzer
from aiAgent.platform_image_router import route_images

def handle_whatsapp_message(message_data):
    user_id = message_data['user_id']
    sheet_id = message_data['sheet_id']  # From agent config or request
    platform = 'whatsapp'
    recipient_id = message_data['from']
    user_message = message_data['text']
    
    # Call AI with tool support
    result = generate_gemini_reply_with_tools(
        prompt=agent_config.system_prompt,
        history=chat_history,
        current_message=user_message,
        agent_config=agent_config,
        user_id=user_id,
        sheet_id=sheet_id,
        platform=platform,
        enable_image_tool=True
    )
    
    # Send response to platform
    send_whatsapp_message(
        recipient_id=recipient_id,
        message_type='text',
        text=result['reply'],
        agent_config=agent_config
    )
```

### Step 2: Configure MinIO (Already in docker-compose.yml)
Already configured! Check:
- `MINIO_API_DOMAIN`
- `MINIO_CONSOLE_DOMAIN`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### Step 3: Register URLs
Already done! In `jwtauth/datasheet/urls.py`:
```python
path('spreadsheets/<int:sheet_id>/row-image-presigned-url/', 
     RowImagePresignedURLView.as_view(), 
     name='row-image-presigned-url'),
```

## 🧪 Testing

### Test 1: Get Presigned URLs
```bash
curl -X GET "http://localhost:8000/datasheet/spreadsheets/5/row-image-presigned-url/?row_index=2&platform=whatsapp&limit=3" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response** (200 OK):
```json
{
    "presigned_urls": [
        {
            "url": "https://minio.newsmartagent.cloud/...",
            "caption": "Blue Shirt - Product XYZ",
            "position": 0
        }
    ],
    "platform": "whatsapp",
    "expires_in": 60,
    "total": 1
}
```

### Test 2: Query Analysis
```python
from aiAgent.caption_handler import QueryAnalyzer

# Test 1: Just want to see images
q1 = QueryAnalyzer("দেখাও ছবি")
print(q1.analyze())  
# Output: {'wants_details': False, 'detail_level': 'image_only', ...}

# Test 2: Want price details
q2 = QueryAnalyzer("এই পণ্যের দাম কত?")
print(q2.analyze())
# Output: {'wants_details': True, 'detail_type': 'price', 'detail_level': 'with_caption', ...}

# Test 3: Want stock/availability
q3 = QueryAnalyzer("স্টক আছে? কত পিস উপলব্ধ?")
print(q3.analyze())
# Output: {'wants_details': True, 'detail_type': 'stock', ...}
```

### Test 3: Image Tool Execution
```python
from aiAgent.image_delivery_tools import execute_image_delivery_tool

result = execute_image_delivery_tool(
    user_id=1,
    sheet_id=5,
    tool_params={
        'row_index': 2,
        'platform': 'whatsapp',
        'limit': 3
    },
    agent_config=agent_config
)

print(result)
# Output: {
#     'status': 'success',
#     'platform': 'whatsapp',
#     'images': [...],
#     'expires_in': 60
# }
```

### Test 4: Platform Router
```python
from aiAgent.platform_image_router import route_images

result = route_images(
    platform='whatsapp',
    recipient_id='+880123456789',
    image_urls=[
        'https://minio.../img1.jpg?X-Amz-Signature=...'
    ],
    captions=['Red T-Shirt XYZ'],
    agent_config=agent_config,
    message_text="Here's your product!"
)

print(result)
# Output: {'status': 'success', 'platform': 'whatsapp', 'images_sent': 1, ...}
```

## 🔐 Security Features

1. **Platform Verification**: 
   - Only the requesting platform receives URLs
   - Caller info logged (user_id, platform, timestamp, IP)

2. **Presigned URLs**:
   - 60-second expiration
   - Cryptographically signed by MinIO
   - Cannot be reused after expiry

3. **No Automatic Captions**:
   - Captions ONLY sent if user explicitly asks for details
   - Reduces noise and maintains clean image flow

4. **User-Specific Access**:
   - Images tied to user's spreadsheet
   - Authentication required on presigned URL endpoint

## 📝 Database Models

### RowImage (Existing)
```python
class RowImage(models.Model):
    user = ForeignKey(User)
    row_id = CharField()  # "sheet_5_row_2"
    image_url = TextField()  # MinIO or external URL
    image_caption = TextField()  # Generated by Gemini
    image_embedding = VectorField()  # For search
    is_primary = BooleanField()
    position = IntegerField()
    source = CharField()  # manual, auto_search, playwright
    created_at = DateTimeField(auto_now_add=True)
```

No new models required!

## 🎯 Flow Diagram

```
User: "আমার জন্য নীল শার্টের ছবি দেখাও এবং দাম বলো"
  ↓
WhatsApp Webhook
  ↓
AI Handler → Gemini with Tools
  ├─ Gemini detects: user wants IMAGES + DETAILS (price)
  ├─ Calls Tool: get_product_images_with_presigned_urls
  │  └─ row_index=2, platform=whatsapp, limit=3
  │  └─ Returns: presigned_urls with captions
  │
  ├─ AI formats response:
  │  📸 Product Images:
  │  1. [View Image](presigned_url_expires_60s)
  │  
  │  📝 Details:
  │  💱 Price: 1,500 TK
  │
  └─ Sends via Platform Router
     └─ send_to_whatsapp(recipient, image_url, caption="দাম: ১,৫০০ টাকা")
```

## ✅ Checklist

- [x] RowImagePresignedURLView created
- [x] Platform verification logic added
- [x] MinIO presigned URL generation
- [x] ImageDeliveryTool created
- [x] Gemini function_calling integration
- [x] QueryAnalyzer for caption logic
- [x] Caption handler for user queries
- [x] PlatformImageRouter for multi-platform delivery
- [x] Syntax validation passed
- [ ] **Next**: Update webhook handlers to use new system
- [ ] **Next**: Test with real platform webhooks
- [ ] **Next**: Add logging and monitoring

## 🎓 Key Concepts

1. **Presigned URLs**: Temporary links generated by MinIO that grant access without authentication
2. **Function Calling**: Gemini can call tools defined in the system prompt
3. **Platform Routing**: Centralized logic to send to different platforms
4. **Smart Captions**: Captions intelligently shown based on user intent analysis

---

**System Status**: ✅ Ready for Integration
**Last Updated**: 2026-03-06
**Maintainer**: Smart Agent AI Team
