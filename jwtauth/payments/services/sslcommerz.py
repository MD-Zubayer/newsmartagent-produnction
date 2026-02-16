# import requests
# from django.conf import settings


# def create_sslcomerz_session(payment):
#     profile = payment.profile
#     user = profile.user

#     url = "https://sandbox.sslcommerz.com/gwprocess/v4/api.php"

#     if not settings.SSL_COMMERZ_SANDBOX:
#         url = "https://securepay.sslcommerz.com/gwprocess/v4/api.php"

#     payload = {
#         "store_id": settings.SSL_COMMERZ_STORE_ID,
#         "store_passwd": settings.SSL_COMMERZ_STORE_PASSWORD,

#         "total_amount": float(payment.amount),
#         "currency": "BDT",
#         "tran_id": str(payment.id),

#         "success_url": "http://localhost:3000/payment/success",
#         "fail_url": "http://localhost:3000/payment/fail",
#         "cancel_url": "http://localhost:3000/payment/cancel",
#         "ipn_url": "http://localhost:8000/api/payments/sslcommerz-ipn/",

#         "cus_name": profile.name,
#         "cus_email": user.email,
#         "cus_phone": profile.phone_number or "017XXXXXXXX",

#         "shipping_method": "NO",
#         "product_name": payment.offer.name,
#         "product_category": "Subscription",
#         "product_profile": "general",
#     }

#     res = requests.post(url, data=payload).json()

#     if res.get("status") == "SUCCESS":
#         return res["GatewayPageURL"]

#     raise Exception(res)
