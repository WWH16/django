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

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import update_session_auth_hash
from .serializers import ChangePasswordSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password_withEmail(request):
    if request.method == 'POST':
        serializer = ChangePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if user.check_password(serializer.data.get('old_password')):
                user.set_password(serializer.data.get('new_password'))
                user.save()
                update_session_auth_hash(request, user)  # To update session after password change
                return Response({'message': 'Password changed successfully.'}, status=status.HTTP_200_OK)
            return Response({'error': 'Incorrect old password.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    

from django.shortcuts import render

def test_password_reset_email(request):
    context = {
        'current_user': request.user,
        'username': request.user.username if request.user.is_authenticated else 'testuser',
        'email': request.user.email if request.user.is_authenticated else 'testuser@example.com',
        'reset_password_url': 'http://example.com/reset-password?token=exampletoken',
    }
    return render(request, 'email/password_reset_email.html', context)

# Add this function to your views.py
from django.urls import reverse

from django.shortcuts import render
from django.urls import reverse # Make sure this is imported

def password_reset_form_view(request):
    """
    Simple view to render your password reset form.
    """
    # This line now works and will not raise a NoReverseMatch error.
    api_url = reverse('password_reset:reset-password-request')
    context = {'api_url': api_url}
    
    # This will now render your intended template.
    return render(request, 'accounts/email/password_reset_form.html', context)