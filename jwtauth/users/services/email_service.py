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
    "— Smart Agent Team"
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

            <img src="https://yourdomain.com/newsmartagent.jpeg" width="120" style="margin-top: 30px; border-radius: 12px;">

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
              🛡 Secured by SSL • ✅ Smart Automation
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
                <h1 style="color:#0f172a; font-size:32px; font-weight:900; margin-bottom:20px;">Welcome to <span style="color:#4f46e5;">Smart Agent</span></h1>
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
    <p><strong>Verification code:</strong> <span style="font-size:20px;">{otp_code}</span></p>
    <p>This code will expire in 5 minutes. If you didn't request it, please ignore.</p>
    """
    send_mail(
        subject,
        message,
        settings.DEFAULT_FROM_EMAIL,
        [to_email],
        fail_silently=True,
        html_message=html_message,
    )
