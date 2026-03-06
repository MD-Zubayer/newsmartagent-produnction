import base64
import hashlib
import hmac
import json

def create_fake_signed_request(payload, secret):
    encoded_payload = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip('=')
    sig = hmac.new(secret.encode(), encoded_payload.encode(), hashlib.sha256).digest()
    encoded_sig = base64.urlsafe_b64encode(sig).decode().rstrip('=')
    return f"{encoded_sig}.{encoded_payload}"

# আপনার ডেটা
APP_SECRET = "7c0693dacfc6211613d16437be2192b8" # আপনার settings.py এর secret টা দিন
data = {
    "user_id": "947204378476536", # যে page_id টা ডিলিট করতে চান
    "algorithm": "HMAC-SHA256"
}

print(create_fake_signed_request(data, APP_SECRET))



