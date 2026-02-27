"""
WSGI config for jwtauth project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application
from django.core.wsgi import get_wsgi_application
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor



os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jwtauth.settings')

# ট্রেসার প্রোভাইডার সেটআপ
provider = TracerProvider()
# সিগনোস এন্ডপয়েন্টে ট্রেস এক্সপোর্ট করা
exporter = OTLPSpanExporter(endpoint="https://monitor.newsmartagent.com", insecure=True)
processor = BatchSpanProcessor(exporter)
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

# Django ইন্সট্রুমেন্টেশন চালু করা
DjangoInstrumentor().instrument()

application = get_wsgi_application()
