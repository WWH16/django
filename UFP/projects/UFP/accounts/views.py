import json
from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.models import User
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.admin.models import LogEntry, ADDITION, DELETION
from django.contrib.contenttypes.models import ContentType
from system.models import Student, Program, Department
from system.utils import log_student_activity
from django.http import JsonResponse
import re
from .forms import StudentLoginForm
from .forms import AdminLoginForm
from .forms import RegisterForm
from django.contrib.auth.views import PasswordResetConfirmView

def select_view(request):
    return render(request, 'accounts/select.html')

# Student Login
def login_student_view(request):
    # 🔹 Skip login form only if "Remember Me" was checked before
    if request.user.is_authenticated and request.session.get('remember_me', False):
        try:
            Student.objects.get(studentID=request.user.username)
            return redirect('give_feedback')  # student dashboard
        except Student.DoesNotExist:
            pass

    if request.method == 'POST':
        form = StudentLoginForm(request.POST)
        if form.is_valid():
            student_id = form.cleaned_data['student_id']
            password = form.cleaned_data['password']
            remember = request.POST.get('remember') == 'on'

            user = authenticate(request, username=student_id, password=password)

            if user and user.is_active and not user.is_staff:
                auth_login(request, user)

                # 🔹 Log student login activity
                try:
                    student = Student.objects.get(studentID=user.username)
                    log_student_activity(
                        student=student,
                        activity_type='StudentLoggedIn'
                    )
                except Student.DoesNotExist:
                    pass

                # 🔹 Handle Remember Me session
                if remember:
                    request.session.set_expiry(60 * 60 * 24 * 30)  # 30 days
                    request.session['remember_me'] = True
                else:
                    request.session.set_expiry(0)  # Until browser closes
                    request.session['remember_me'] = False

                messages.success(
                    request,
                    f'Welcome, {user.first_name or user.username}!',
                    extra_tags='login'
                )
                return redirect('give_feedback')
            else:
                messages.error(
                    request,
                    'Invalid student ID or password.',
                    extra_tags='login'
                )
    else:
        form = StudentLoginForm()

    return render(request, 'accounts/login_student.html', {'form': form})




# Registration (for students only)
import re

def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            student_id = form.cleaned_data['student_id']
            username = student_id
            password = form.cleaned_data['password']
            confirm_password = form.cleaned_data['confirm_password']
            fullname = form.cleaned_data['fullname']
            email = form.cleaned_data['email']
            department_id = form.cleaned_data['department']
            program_id = form.cleaned_data['program']

            # Password requirements validation
            if password != confirm_password:
                messages.error(request, 'Passwords do not match.')
                return redirect('register')

            if User.objects.filter(username=username).exists():
                messages.error(request, 'Student ID already exists.')
                return redirect('register')

            # Other validations (email, student id format, etc.) here...

            # If all valid, create user and student
            try:
                program = Program.objects.get(programID=program_id)
                user = User.objects.create_user(
                    username=username,
                    password=password,
                    first_name=fullname,
                    email=email
                )
                user.is_staff = False
                user.is_superuser = False
                user.save()

                student = Student.objects.create(
                    studentID=student_id,
                    studentName=fullname,
                    program=program,
                    password=user.password  # hashed password
                )

                log_student_activity(
                    student=student,
                    activity_type='AccountCreated'
                )

                messages.success(request, 'Student account created successfully! You can now login.')
                return redirect('login_student')

            except Program.DoesNotExist:
                messages.error(request, 'Selected program does not exist.')
                return redirect('register')

            except Exception as e:
                messages.error(request, f'Error creating account: {str(e)}')
                return redirect('register')

        else:
            departments = Department.objects.all()
            return render(request, 'accounts/register.html', {'form': form, 'departments': departments})

    else:
        departments = Department.objects.all()
        form = RegisterForm()
        return render(request, 'accounts/register.html', {'form': form, 'departments': departments})



# Logout
def logout_view(request):
    if request.user.is_authenticated:
        if request.user.is_staff:
            # Log admin logout
            LogEntry.objects.log_action(
                user_id=request.user.pk,
                content_type_id=ContentType.objects.get_for_model(User).pk,
                object_id=request.user.pk,
                object_repr=str(request.user),
                action_flag=DELETION,
                change_message="Admin logged out."
            )
        else:
            # Log student logout
            try:
                student = Student.objects.get(studentID=request.user.username)
                log_student_activity(
                    student=student,
                    activity_type='StudentLoggedOut'
                )
            except Student.DoesNotExist:
                pass
    
    list(messages.get_messages(request))  # This will clear all messages
    auth_logout(request)
    return redirect('select')


# Shared Dashboard (optional)
@login_required
def dashboard_view(request):
    return render(request, 'dashboard.html')

        # AJAX endpoint for getting programs by department
def get_programs_by_department(request, department_id):
    try:
        programs = Program.objects.filter(department_id=department_id)
        program_list = []
        for program in programs:
            program_list.append({
                'programID': program.programID,
                'programName': program.programName
            })
        return JsonResponse({'programs': program_list})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

@login_required
def edit_profile(request):
    if request.method == 'POST':
        user = request.user
        first_name = request.POST.get('first_name')
        email = request.POST.get('email')
        # Update user fields
        user.first_name = first_name
        user.email = email
        user.save()
        # Log activity in StudentActivityLog and sync studentName
        try:
            student = Student.objects.get(studentID=user.username)
            student.studentName = first_name  # Sync full name
            student.save()
            # Assuming StudentActivityLog is defined elsewhere or needs to be imported
            # from system.models import StudentActivityLog
            # StudentActivityLog.objects.create(
            #     student=student,
            #     activity_type='Profile updated.'
            # )
        except Student.DoesNotExist:
            pass
        messages.success(request, 'Profile updated successfully!')
    return redirect('profile')

from django.shortcuts import render
from django.urls import reverse
from django.core.mail import EmailMultiAlternatives
from django.dispatch import receiver
from django.template.loader import render_to_string
from django_rest_passwordreset.signals import reset_password_token_created
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import update_session_auth_hash
from .serializers import ChangePasswordSerializer
import logging

logger = logging.getLogger(__name__)

# ------------------------------
# Reset password confirmation page
# ------------------------------
from django.shortcuts import render
from django.urls import reverse
from rest_framework.test import APIClient
def password_reset_form_view(request):
    """
    Handles the password reset form submission.
    """
    # DRF password reset API endpoint
    api_url = reverse('password_reset:reset-password-request')

    if request.method == 'POST':
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            data = request.POST

        email = data.get('email', '').strip()

        # Validate email input
        if not email:
            return render(request, 'accounts/email/password_reset_form.html', {
                'api_url': api_url,
                'error': 'Please enter an email address.'
            })

        # Check if user exists
        if not User.objects.filter(email=email).exists():
            return render(request, 'accounts/email/password_reset_form.html', {
                'api_url': api_url,
                'error': 'No user found with that email address.'
            })

        # Call DRF password reset API without sending default email
        client = APIClient()
        response = client.post(api_url, {'email': email, 'send_email':False}, format='json')

        if response.status_code in [200, 201]:  # Success
            return redirect('password_reset_sent')  # Redirect to custom success page
        else:
            # Extract error from DRF response
            error_msg = 'An error occurred. Please try again.'
            try:
                data = response.json()
                if 'email' in data and len(data['email']) > 0:
                    error_msg = data['email'][0]
                elif 'non_field_errors' in data:
                    error_msg = ' '.join(data['non_field_errors'])  
            except Exception:
                pass

            return render(request, 'accounts/email/password_reset_form.html', {
                'api_url': api_url,
                'error': error_msg
            })

    # GET request: render the form
    return render(request, 'accounts/email/password_reset_form.html', {'api_url': api_url})

from django.shortcuts import render

def reset_password_confirm_view(request):
    """
    Renders the password reset confirmation form.
    Reads the token from the URL query parameters.
    """
    token = request.GET.get('token', '')
    context = {'token': token}
    return render(request, 'accounts/email/password_reset_confirm.html', context)




# ------------------------------
# Change password API (authenticated users)
# ------------------------------
from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django_rest_passwordreset.models import ResetPasswordToken

def reset_password_confirm_view(request):
    """
    Renders and processes the password reset confirmation form.
    """
    token = request.GET.get('token', '')

    if request.method == 'POST':
        new_password = request.POST.get('new_password')
        confirm_password = request.POST.get('new_password_confirmation')

        if new_password != confirm_password:
            return render(request, 'accounts/email/password_reset_confirm.html', {
                'token': token,
                'error': 'Passwords do not match.'
            })

        try:
            reset_token = ResetPasswordToken.objects.get(key=token)
            user = reset_token.user
            user.set_password(new_password)
            user.save()

            # ✅ Log activity if this user is linked to a Student
            try:
                student = Student.objects.get(studentID=user.username)
                log_student_activity(
                    student=student,
                    activity_type='PasswordChanged'
                )
            except Student.DoesNotExist:
                pass  # In case it's not a student (admin, etc.)

            # remove the token so it can't be reused
            reset_token.delete()

            # redirect to complete page
            return redirect('password_reset_complete')

        except ResetPasswordToken.DoesNotExist:
            return render(request, 'accounts/email/password_reset_confirm.html', {
                'error': 'Invalid or expired token.'
            })

    # GET request → render the form
    return render(request, 'accounts/email/password_reset_confirm.html', {'token': token})
