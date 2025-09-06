from django.apps import AppConfig
from django.apps import AppConfig

'''class LoginConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    '''

class AccountsConfig(AppConfig):
    name = 'accounts'

    def ready(self):
        import accounts.signals  # Add this line to import the signals.py