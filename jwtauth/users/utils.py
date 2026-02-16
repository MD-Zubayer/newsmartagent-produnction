from django.db import transaction
from .models import UniqueIDPool

def assign_unique_id():
    with transaction.atomic():
        pool_obj = (
            UniqueIDPool.objects
            .select_for_update()   # 🔥 lock row
            .filter(is_used=False)
            .first()
        )

        if not pool_obj:
            raise Exception("No more pre-generated IDs available!")

        pool_obj.is_used = True
        pool_obj.save(update_fields=["is_used"])

        return pool_obj.uid
