from allauth.account.forms import SignupForm
# from allauth.socialaccount.forms import SignupForm as SocialSignupForm
from django.contrib.auth import forms as admin_forms
from django.forms import EmailField
from django import forms
from django.utils.translation import gettext_lazy as _

from .models import User

class UserAdminChangeForm(admin_forms.UserChangeForm):
    class Meta(admin_forms.UserChangeForm.Meta):
        model = User
        fields = (
            "email",
            "name",
            "phone_number",
            "division",
            "district",
            "upazila",
            "gender",
            "id_type",
            "created_by",
        )
        field_classes = {"email": EmailField}


class UserAdminCreationForm(admin_forms.UserCreationForm):
    class Meta(admin_forms.UserCreationForm.Meta):
        model = User
        fields = (
            "email",
            "name",
            "phone_number",
            "division",
            "district",
            "upazila",
            "gender",
            "id_type",
            "created_by",
        )
        field_classes = {"email": EmailField}
        error_messages = {
            "email": {"unique": _("This email has already been taken.")},
        }

class UserSignupForm(SignupForm):
    """
    Form that will be rendered on a user sign up section/screen.
    Default fields will be added automatically.
    Check UserSocialSignupForm for accounts created from social.
    """

    email = forms.EmailField(label=_("Email"), required=True)
    name = forms.CharField(max_length=255, label=_("Full Name"))
    phone_number = forms.CharField(max_length=20, label=_("Phone Number"))
    division = forms.CharField(max_length=100, label=_("Division"))
    district = forms.CharField(max_length=100, label=_("District"))
    upazila = forms.CharField(max_length=100, label=_("Upazila"))
    gender = forms.ChoiceField(
        choices=[('M', 'Male'), ('F', 'Female'), ('O', 'Other')],
        label=_("Gender")
    )
    id_type = forms.ChoiceField(
        choices=[('personal', 'Personal ID'), ('business', 'Business ID')],
        label=_("ID Type")
    )

    def save(self, request):
        user = super().save(request)
        user.name = self.cleaned_data["name"]
        user.phone_number = self.cleaned_data["phone_number"]
        user.division = self.cleaned_data["division"]
        user.district = self.cleaned_data["district"]
        user.upazila = self.cleaned_data["upazila"]
        user.gender = self.cleaned_data["gender"]
        user.id_type = self.cleaned_data["id_type"]
        user.save()
        return user


# class UserSocialSignupForm(SocialSignupForm):
#     """
#     Renders the form when user has signed up using social accounts.
#     Default fields will be added automatically.
#     See UserSignupForm otherwise.
#     """
