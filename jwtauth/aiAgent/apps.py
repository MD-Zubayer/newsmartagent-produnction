from django.apps import AppConfig


class AiagentConfig(AppConfig):
    name = 'aiAgent'

    def ready(self):
        # Monkey patch django-cryptography to handle BadSignature gracefully
        try:
            from django_cryptography.fields import EncryptedMixin, PickledField
            from django.core.signing import BadSignature
            import logging
            logger = logging.getLogger(__name__)

            # Patch EncryptedMixin
            original_mixin_from_db_value = EncryptedMixin.from_db_value
            def safe_mixin_from_db_value(self_field, value, *args, **kwargs):
                try:
                    return original_mixin_from_db_value(self_field, value, *args, **kwargs)
                except BadSignature as e:
                    logger.warning(f"🔒 BadSignature caught in EncryptedMixin decryption: {e}. Returning None.")
                    return None
            EncryptedMixin.from_db_value = safe_mixin_from_db_value

            # Patch PickledField
            original_pickled_from_db_value = PickledField.from_db_value
            def safe_pickled_from_db_value(self_field, value, *args, **kwargs):
                try:
                    return original_pickled_from_db_value(self_field, value, *args, **kwargs)
                except BadSignature as e:
                    logger.warning(f"🔒 BadSignature caught in PickledField decryption: {e}. Returning None.")
                    return None
            PickledField.from_db_value = safe_pickled_from_db_value

            logger.info("✅ Successfully monkey-patched django_cryptography to handle BadSignature safely.")
        except Exception as patch_err:
            print(f"Error patching django_cryptography: {patch_err}")
