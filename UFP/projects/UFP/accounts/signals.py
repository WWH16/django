from django.core.mail import EmailMultiAlternatives
from django.dispatch import receiver
from django.template.loader import render_to_string
from django.urls import reverse

from django_rest_passwordreset.signals import reset_password_token_created

import logging
logger = logging.getLogger(__name__)
# ------------------------------
# Signal for sending reset email
# ------------------------------
@receiver(reset_password_token_created)
def password_reset_token_created(sender, instance, reset_password_token, *args, **kwargs):
    logger.info(f"Signal triggered for user: {reset_password_token.user.email}")

    reset_url = "{}?token={}".format(
        instance.request.build_absolute_uri(reverse('reset_password_confirm_view')),
        reset_password_token.key
    )

    context = {
        'current_user': reset_password_token.user,
        'username': reset_password_token.user.username,
        'email': reset_password_token.user.email,
        'reset_password_url': reset_url
    }

    # Render email
    email_html_message = render_to_string('accounts/email/password_reset_email.html', context)
    email_plaintext_message = render_to_string('accounts/email/password_reset_email.txt', context)

    msg = EmailMultiAlternatives(
        subject="Password Reset for University Feedback Platform",
        body=email_plaintext_message,
        from_email="no-reply@ufplatform.com",
        to=[reset_password_token.user.email]
    )
    msg.attach_alternative(email_html_message, "text/html")
    msg.send()