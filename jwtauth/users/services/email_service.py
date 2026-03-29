# # users/services/email_service.py

# from mailjet_rest import Client
# from django.conf import settings



# def send_reset_email(to_email, reset_link):
#     mailjet = Client(
#         auth=(settings.MAILJET_API_KEY, settings.MAILJET_SECRET_KEY), 
#         version='v3.1'

#     )

#     data = {
#         'Messages': [
#             {
#                 "From": {
#                     "Email": "newsmartagentbd@gmail.com", 
#                     "Name": "new smart agnet"
#                 },
#                 "To": [
#                     {
#                         "Email": to_email
#                     }
#                 ], 
#                 "Subject": "Reset your password",
#                 "TextPart": f"Reset your password: {reset_link}",
#                 "HTMLPart": f"""
#                   <p>Click the link below to reset your password:</p>
#                     <a href="{reset_link}">Reset Password</a>
#                 """
#             }

#         ]
#     }

#     return mailjet.send.create(data=data)

from django.core.mail import send_mail
from django.conf import settings
from datetime import datetime

year = datetime.now().year

def send_reset_email(to_email, reset_link):

   subject = "🔒 Action Required: Reset Your New Smart Agent Password"

# টেক্সট ভার্সন (যদি ইমেইল ক্লায়েন্ট HTML সাপোর্ট না করে)
   message = (
    "Hello 👋\n\n"
    "We received a request to reset the password for your New Smart Agent account.\n\n"
    f"Reset Link: {reset_link}\n\n"
    "⏳ This link expires in 1 hour.\n\n"
    "If you didn’t request this, you can safely ignore this email.\n\n"
    "— New Smart Agent Team"
)

# প্রিমিয়াম HTML ভার্সন
   html_message = f"""
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; background-image: radial-gradient(#4f46e510 1px, transparent 1px); background-size: 30px 30px;">
  <tr>
    <td align="center" style="padding: 60px 20px;">
      <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border-radius:40px; border: 1px solid #f1f5f9; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.05);">
        <tr>
          <td align="center" style="padding: 50px 40px;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td bgcolor="#eef2ff" style="border-radius:100px; padding: 8px 20px; border:1px solid #e0e7ff; color:#4f46e5; font-size:10px; font-weight:900; letter-spacing:1px;">
                  🚀 THE MOST TRUSTED AI IN BD
                </td>
              </tr>
            </table>

            <img src="https://newsmartagent.com/newsmartagent.png" width="120" style="margin-top: 30px; border-radius: 12px;">

            <h1 style="color:#0f172a; font-size:32px; font-weight:900; line-height:1.2; margin: 30px 0 20px 0; letter-spacing:-1px;">
              Automate Your <span style="color:#4f46e5;">Access</span> <br> & Grow Faster
            </h1>

            <p style="color:#64748b; font-size:16px; line-height:26px; margin-bottom:35px;">
              আপনার <b>New Smart Agent</b> অ্যাকাউন্টের পাসওয়ার্ড রিসেট করার জন্য নিচের  বাটনটি ব্যবহার করুন। 
            </p>

            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" bgcolor="#4f46e5" style="border-radius:16px;">
                  <a href="{reset_link}" style="padding: 18px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 900; display: inline-block;">Reset Password</a>
                </td>
              </tr>
            </table>

            <p style="color:#94a3b8; font-size:11px; margin-top:40px; text-transform:uppercase; letter-spacing:1.5px; font-weight:800;">
              🛡 Secured by SSL • ✅ New Smart Agent
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
"""
   send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [to_email],
        fail_silently=False,
        html_message=html_message
    )



# --- Verification Email Function ---
def send_verification_email(to_email, verify_link):
    subject = "🚀 Verify Your New Smart Agent Account"
    
    # প্লেইন টেক্সট ভার্সন
    message = f"Please verify your account by clicking this link: {verify_link}"
    
    # আপনার প্রিমিয়াম HTML টেমপ্লেট (Verification এর জন্য কিছুটা মডিফাইড)
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background-color:#ffffff; font-family:'Segoe UI',Arial,sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-image: radial-gradient(#4f46e510 1px, transparent 1px); background-size: 30px 30px;">
      <tr>
        <td align="center" style="padding: 60px 20px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border-radius:40px; border: 1px solid #f1f5f9; box-shadow: 0 30px 60px -12px rgba(0,0,0,0.05);">
            <tr>
              <td align="center" style="padding: 50px 40px;">
                <img src="https://newsmartagent.com/newsmartagent.png" width="100" style="margin-bottom: 25px; border-radius: 12px;">
                <h1 style="color:#0f172a; font-size:32px; font-weight:900; margin-bottom:20px;">Welcome to <span style="color:#4f46e5;">New Smart Agent</span></h1>
                <p style="color:#64748b; font-size:16px; margin-bottom:35px;">অ্যাকাউন্টটি সচল করতে নিচের বাটনে ক্লিক করে আপনার ইমেইল ভেরিফাই করুন।</p>
                <table border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center" bgcolor="#4f46e5" style="border-radius:16px;">
                      <a href="{verify_link}" style="padding: 18px 40px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 900; display: inline-block;">Verify Email</a>
                    </td>
                  </tr>
                </table>
                <p style="color:#94a3b8; font-size:11px; margin-top:40px;">🛡 Secured by SSL • ✅ Smart Automation</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>
    """
    
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [to_email],
        fail_silently=False,
        html_message=html_message
    )


def send_2fa_otp_email(to_email: str, otp_code: str):
    """Send a simple 6-digit OTP for email-based 2FA."""
    subject = "Your Login Verification Code"
    message = (
        f"Your verification code is: {otp_code}\n\n"
        "It will expire in 5 minutes. If you didn't try to log in, you can ignore this email."
    )
    html_message = f"""
    <!DOCTYPE html>
    <html lang="bn">
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                background-color: #f4f7fa;
                margin: 0;
                padding: 0;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }}
            .wrapper {{
                width: 100%;
                table-layout: fixed;
                background-color: #f4f7fa;
                padding-bottom: 40px;
                padding-top: 40px;
            }}
            .main-card {{
                background-color: #ffffff;
                max-width: 450px;
                margin: 0 auto;
                border-radius: 16px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.05);
                overflow: hidden;
                border: 1px solid #e5e7eb;
            }}
            .header-accent {{
                background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
                height: 6px;
                width: 100%;
            }}
            .content {{
                padding: 40px 30px;
                text-align: center;
            }}
            .logo-text {{
                font-size: 22px;
                font-weight: 800;
                color: #1f2937;
                letter-spacing: -0.5px;
                margin-bottom: 24px;
                display: block;
                text-decoration: none;
            }}
            .logo-text span {{
                color: #2563eb;
            }}
            h1 {{
                font-size: 20px;
                color: #111827;
                margin-bottom: 8px;
                font-weight: 700;
            }}
            p {{
                font-size: 14px;
                line-height: 22px;
                color: #4b5563;
                margin-bottom: 24px;
            }}
            .otp-container {{
                background-color: #f8fafc;
                border: 2px dashed #cbd5e1;
                border-radius: 12px;
                padding: 20px;
                margin: 24px 0;
            }}
            .otp-number {{
                font-size: 36px;
                font-weight: 800;
                color: #2563eb;
                letter-spacing: 8px;
                margin: 0;
            }}
            .timer {{
                display: inline-flex;
                align-items: center;
                font-size: 12px;
                color: #ef4444;
                font-weight: 600;
                background: #fef2f2;
                padding: 4px 12px;
                border-radius: 20px;
                margin-bottom: 10px;
            }}
            .footer {{
                padding: 0 30px 30px;
                text-align: center;
            }}
            .divider {{
                height: 1px;
                background-color: #f3f4f6;
                margin-bottom: 20px;
            }}
            .help-text {{
                font-size: 12px;
                color: #9ca3af;
                line-height: 18px;
            }}
            .social-links {{
                margin-top: 15px;
            }}
            .social-links a {{
                color: #2563eb;
                text-decoration: none;
                font-size: 12px;
                font-weight: 600;
            }}
        </style>
    </head>
    <body>
        <div class="wrapper">
            <div class="main-card">
                <div class="header-accent"></div>
                <div class="content">
                    <a href="https://newsmartagent.com" class="logo-text">NEW<span>SMART</span>AGENT</a>
                    <h1>Confirm Your Identity</h1>
                    <p>Hello! Use the verification code below to securely log into your dashboard.</p>
                    
                    <div class="timer">⏱ Expires in 5 minutes</div>
                    
                    <div class="otp-container">
                        <div class="otp-number">{otp_code}</div>
                    </div>
                    
                    <p style="font-size: 13px;">If you didn't request this, you can safely ignore this email. Your account security is our priority.</p>
                </div>
                <div class="footer">
                    <div class="divider"></div>
                    <div class="help-text">
                        &copy; 2026 New Smart Agent AI. <br>
                        Faridpur, Dhaka, Bangladesh.
                    </div>
                    <div class="social-links">
                        <a href="#">Support</a> &nbsp;•&nbsp; <a href="#">Privacy Policy</a>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [to_email],
        fail_silently=True,
        html_message=html_message,
    )

def send_security_alert_email(to_email: str, device_name: str, ip_address: str, time_str: str):
    """Send an alert when a login occurs from a new or unrecognized device."""
    subject = "⚠️ Security Alert: New Login to your NSA Account"
    message = (
        f"A new login was detected on your New Smart Agent account.\n\n"
        f"Device: {device_name}\n"
        f"IP Address: {ip_address}\n"
        f"Time: {time_str}\n\n"
        "If this was you, you don't need to do anything. If you didn't log in recently, "
        "please secure your account immediately by resetting your password."
    )
    
    html_message = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; border-top: 4px solid #ef4444;">
            <h2 style="color: #1f2937;">New Login Detected</h2>
            <p style="color: #4b5563;">We noticed a new login to your New Smart Agent account from an unrecognized device.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Device:</strong> {device_name}</p>
                <p style="margin: 5px 0;"><strong>IP Address:</strong> {ip_address}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> {time_str}</p>
            </div>
            <p style="color: #4b5563;">If this was you, you can safely ignore this email.</p>
            <p style="color: #4b5563;">If you don't recognize this activity, please change your password immediately.</p>
        </div>
    </div>
    """
    send_mail(
        subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True, html_message=html_message
    )


def send_push_approval_email(to_email: str, approve_link: str, reject_link: str, device_name: str):
    """Send Magic Link for Passwordless / Push Authentication login approval."""
    subject = "🔑 Approve Login Request"
    message = (
        f"Are you trying to sign in to New Smart Agent from {device_name}?\n\n"
        f"Yes, it's me: {approve_link}\n\n"
        f"No, secure account: {reject_link}\n"
    )
    
    html_message = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #f9f9f9;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; border-top: 4px solid #2563eb; text-align: center;">
            <h1 style="color: #1f2937; font-size: 24px;">Login Approval Request</h1>
            <p style="color: #4b5563; font-size: 16px;">Are you trying to sign in to your New Smart Agent account from <strong>{device_name}</strong>?</p>
            
            <div style="margin: 30px 0;">
                <a href="{approve_link}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-right: 15px; display: inline-block;">✅ Yes, it's me</a>
                <a href="{reject_link}" style="background-color: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">❌ No, it's not me</a>
            </div>
            
            <p style="color: #9ca3af; font-size: 12px;">This link expires in 5 minutes. If you didn't request this, tap 'No' or ignore this email.</p>
        </div>
    </div>
    """
    send_mail(
        subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True, html_message=html_message
    )


def send_whatsapp_alert(phone_number: str, message_text: str):
    """Send Security Alert or Push Authentication message to WhatsApp."""
    import os
    import requests
    import logging
    logger = logging.getLogger(__name__)
    
    webhook_url = os.getenv("N8N_WHATSAPP_DELIVERY_URL", "https://n8n.newsmartagent.com/webhook/whatsapp-delivery")
    if not phone_number.startswith('+'):
        phone_number = '+' + phone_number.lstrip('0')
        
    formatted_phone = phone_number.replace('+', '')
    
    payload = {
        "to": formatted_phone + "@s.whatsapp.net",
        "phone": formatted_phone,
        "message": message_text,
        "type": "whatsapp",
        "system_alert": True
    }
    
    try:
        requests.post(webhook_url, json=payload, timeout=10)
        logger.info(f"WhatsApp security alert sent to {formatted_phone}")
    except Exception as e:
        logger.error(f"Failed to send WhatsApp security alert: {e}")

