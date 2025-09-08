from django.apps import AppConfig
from django_rest_passwordreset.signals import reset_password_token_created
from django.dispatch import receiver
'''class LoginConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    '''



class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # your custom signal
        # Disconnect default DRF email sender
        from django_rest_passwordreset.models import ResetPasswordToken
        ResetPasswordToken.send_email = None
