from django.core.management.base import BaseCommand
import logging

logger = logging.getLogger('products')
from datasheet.models import Product
from datasheet.services import sync_product_search_document
from embedding.models import ProductSearchDocument
from embedding.utils import get_gemini_embedding


class Command(BaseCommand):
    help = "Build or refresh semantic search vectors for Products."

    def add_arguments(self, parser):
        parser.add_argument("--product-id", type=int, default=None)

    def handle(self, *args, **options):
        products = Product.objects.prefetch_related("variants")
        if options["product_id"]:
            products = products.filter(id=options["product_id"])
        updated = 0
        failed = 0
        for product in products:
            sync_product_search_document(product)
            document = ProductSearchDocument.objects.get(product=product)
            vector = get_gemini_embedding(document.content)
            if vector:
                document.embedding = vector
                document.save(update_fields=["embedding", "updated_at"])
                updated += 1
                logger.info("product_vector_indexed product_id=%s", product.id)
            else:
                failed += 1
                logger.warning("product_vector_index_failed product_id=%s", product.id)
        self.stdout.write(self.style.SUCCESS(f"Product vectors updated: {updated}; failed: {failed}"))
