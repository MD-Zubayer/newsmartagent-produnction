import phonenumbers
from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_international_phone(value):
    try:
        parsed_number = phonenumbers.parse(value, None)

        if not phonenumbers.is_valid_number(parsed_number):
            raise ValidationError(_("The phone number is not valid international format."))
        
    except phonenumbers.phonenumberutil.NumberParseException:
        raise ValidationError(_("Please enter a valid phone number with country code (e.g., +880...)"))
    