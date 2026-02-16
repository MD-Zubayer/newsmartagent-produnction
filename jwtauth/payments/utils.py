# from django.conf import settings


# def create_sslcomerz_session(payment):

#     sslcommerz = SSLCOMMERZ(
#         store_id=settings.SSLCOMMERZ_STORE_ID,
#         store_password=settings.SSLCOMMERZ_STORE_PASSWORD,
#         snadbox=settings.SSLCOMMERZ_SANDBOX_MODE
#     )

#     payload = {
#         "total_amount": float(payment.amount),
#         "currency": "BDT",
#         "tran_id": str(payment.id),
#         "success_url": f"{settings.SITE_URL}/payment/success?payment_id={payment.id}",
#         "fail_url": f"{settings.SITE_URL}/payment/fail?payment_id={payment.id}",
#         "cancel_url": f"{settings.SITE_URL}/payment/cancel?payment_id={payment.id}",
#         "cus_name": payment.profile.user.get_full_name() or payment.profile.user.email,
#         "cus_email": payment.profile.user.email,
#         "cus_add1": "",
#         "cus_city": "",
#         "cus_postcode": "",
#         "cus_country": "Bangladesh",
#         "cus_phone": "",
#         "shipping_method": "NO",
#         "product_name": payment.offer.name,
#         "product_category": "Subscription",
#         "product_profile": "general",
#     }
#     response = sslcommerz.createSession(payload)
#     return response.get("GatewayPageURL")