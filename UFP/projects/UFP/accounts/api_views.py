from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from .serializers import ResetPasswordEmailSerializer
import traceback
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

class ForgotPasswordView(APIView):
    def post(self, request):
        try:
            logger.info("=== ForgotPasswordView POST called ===")
            logger.info(f"Request data: {request.data}")
            
            # Check if serializer import works
            logger.info("Creating serializer...")
            serializer = ResetPasswordEmailSerializer(data=request.data)
            
            logger.info("Checking serializer validity...")
            if serializer.is_valid():
                logger.info("Serializer is valid")
                email = serializer.validated_data['email']
                logger.info(f"Email extracted: {email}")
                
                try:
                    logger.info("Looking for user...")
                    user = User.objects.get(email=email)
                    logger.info(f"User found: {user.username}")
                    
                    # Generate reset token
                    logger.info("Generating tokens...")
                    uid = urlsafe_base64_encode(force_bytes(user.pk))
                    token = default_token_generator.make_token(user)
                    logger.info(f"Tokens generated - UID: {uid}, Token: {token[:10]}...")
                    
                    # Build reset link
                    reset_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:8000')}/reset-password/{uid}/{token}"
                    logger.info(f"Reset URL: {reset_url}")
                    
                    # Send email
                    logger.info("Attempting to send email...")
                    result = send_mail(
                        subject='Password Reset Request',
                        message=f'''
                        Hello,

                        You have requested to reset your password. Please click the link below to reset your password:

                        {reset_url}

                        If you did not request this password reset, please ignore this email.

                        This link will expire in 24 hours.

                        Best regards,
                        UFP Team
                        ''',
                        from_email='no-reply@ufplatform.com',
                        recipient_list=[email],
                        fail_silently=False,
                    )
                    logger.info(f"Email send result: {result}")
                    
                except User.DoesNotExist:
                    logger.info(f"User with email {email} does not exist")
                    pass  # Silent fail to prevent email enumeration
                except Exception as e:
                    logger.error(f"Error in user lookup or email sending: {str(e)}")
                    logger.error(traceback.format_exc())
                
                logger.info("Returning success response")
                return Response({
                    'message': 'If an account exists with this email, a password reset link has been sent.'
                }, status=status.HTTP_200_OK)
            else:
                logger.warning(f"Serializer errors: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Unexpected error in ForgotPasswordView: {str(e)}")
            logger.error(traceback.format_exc())
            return Response({
                'error': f'Server error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# You can remove ResetPasswordView for now if you don't need it
# Or keep it simple without the complex validation