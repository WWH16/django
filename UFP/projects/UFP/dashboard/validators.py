from django.core.exceptions import ValidationError
from django.utils.translation import gettext as _

class NotSameAsOldPasswordValidator:
    def validate(self, password, user=None):
        if user and user.check_password(password):
            raise ValidationError(
                _("Your new password cannot be the same as your old password."),
                code='password_no_old',
            )

    def get_help_text(self):
        return _("Your new password cannot be the same as your old password.")