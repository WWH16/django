from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.conf import settings
from .serializers import ForgotPasswordSerializer, ResetPasswordSerializer

User = get_user_model()

class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                # Generate reset token
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = default_token_generator.make_token(user)
                
                # Build reset link
                reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
                
                # Send email
                send_mail(
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
            except User.DoesNotExist:
                pass  # Silent fail to prevent email enumeration
            
            return Response({
                'message': 'If an account exists with this email, a password reset link has been sent.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            new_password = serializer.validated_data['new_password']
            
            # Update password
            user.set_password(new_password)
            user.save()
            
            return Response({
                'message': 'Password has been reset successfully.'
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
