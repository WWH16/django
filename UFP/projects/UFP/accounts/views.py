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

# Admin 
def login_admin_view(request):
    if request.method == 'POST':
        form = AdminLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            if user and user.is_staff:
                auth_login(request, user)
                # Log admin login
                LogEntry.objects.log_action(
                    user_id=user.pk,
                    content_type_id=ContentType.objects.get_for_model(User).pk,
                    object_id=user.pk,
                    object_repr=str(user),
                    action_flag=ADDITION,
                    change_message="Admin logged in."
                )
                return redirect('admin_dashboard')
            else:
                # Add a generic error to the form
                form.add_error(None, 'Invalid username or password.')
        # If form is invalid, fall through to render with errors
    else:
        form = AdminLoginForm()
    return render(request, 'accounts/login_admin.html', {'form': form})


# Student Login
def login_student_view(request):
    if request.method == 'POST':
        form = StudentLoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            remember = request.POST.get('remember') == 'on'
            user = authenticate(request, username=username, password=password)
            if user and not user.is_staff:
                auth_login(request, user)
                
                # Log student login activity
                try:
                    student = Student.objects.get(studentID=username)
                    log_student_activity(
                        student=student,
                        activity_type='StudentLoggedIn'
                    )
                except Student.DoesNotExist:
                    # Log error if student record not found
                    pass
                            # Set session expiry based on "Remember Me"
                if remember:
                    request.session.set_expiry(604800)  # 7 days
                else:
                    request.session.set_expiry(0)  # Expires on browser close
                
                messages.success(request, f'Welcome, {user.username}!')
                return redirect('give_feedback')  # Redirect student to feedback form
            else:
                # Replace specific error with generic error for security
                form.add_error(None, 'Invalid username or password.')
                return render(request, 'accounts/login_student.html', {'form': form})
        # If form is invalid, fall through to render with errors
    else:
        form = StudentLoginForm()
    return render(request, 'accounts/login_student.html', {'form': form})


# Registration (for students only)
def register_view(request):
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            student_id = form.cleaned_data['student_id']
            username = student_id  # Use student_id as username
            password = form.cleaned_data['password']
            fullname = form.cleaned_data['fullname']
            email = form.cleaned_data['email']
            department_id = form.cleaned_data['department']
            program_id = form.cleaned_data['program']

            # Debug: Print all form data to see what's being received
            print("DEBUG: All POST data:")
            for key, value in request.POST.items():
                print(f"  {key}: {value}")
            
            print(f"DEBUG: password = {password}")
            print(f"DEBUG: password type = {type(password)}")
            print(f"DEBUG: password is None = {password is None}")
            print(f"DEBUG: password is empty = {password == ''}")
            print(f"DEBUG: password length = {len(password) if password else 0}")

            # Validation
            if not email:
                messages.error(request, 'Email is required.')
                return redirect('register')
            if User.objects.filter(email=email).exists():
                messages.error(request, 'Email is already in use.')
                return redirect('register')

            if not password:
                messages.error(request, 'Password is required.')
                return redirect('register')

            if len(password.strip()) == 0:
                messages.error(request, 'Password cannot be empty.')
                return redirect('register')

            if password != form.cleaned_data['confirm_password']:
                messages.error(request, 'Passwords do not match.')
                return redirect('register')

            if User.objects.filter(username=username).exists():
                messages.error(request, 'Student ID already exists.')
                return redirect('register')

            # Validate student ID format (must be in format: XX-XXXXX)
            student_id_pattern = r'^\d{2}-\d{5}$'
            if not student_id or not re.match(student_id_pattern, student_id):
                messages.error(request, 'Student ID must be in format: XX-XXXXX (e.g., 22-10243)')
                return redirect('register')

            # Validate department and program selection
            if not department_id:
                messages.error(request, 'Please select a department.')
                return redirect('register')

            if not program_id:
                messages.error(request, 'Please select a program.')
                return redirect('register')

            try:
                # Get the selected program
                program = Program.objects.get(programID=program_id)
                
                print(f"DEBUG: About to create user with password: {password[:3]}...")
                
                # Create user with student ID as username
                user = User.objects.create_user(
                    username=username,  # Use student_id as username
                    password=password,  # Use actual password from form
                    first_name=fullname,
                    email=email  # Save the provided email
                )
                user.is_staff = False         # Ensure the user is a student
                user.is_superuser = False     # Prevent superuser privileges
                user.save()

                print(f"DEBUG: User created successfully. Password hash: {user.password[:20]}...")

                # Create Student record with program and password hash (do not save email here)
                student = Student.objects.create(
                    studentID=student_id,
                    studentName=fullname,
                    program=program,
                    password=user.password  # Store the hashed password in Student model too
                    # email is not saved in Student model anymore
                )

                # Log student registration activity
                log_student_activity(
                    student=student,
                    activity_type='StudentProvidedFeedback'
                )

                messages.success(request, 'Student account created successfully! You can now login using your Student ID.')
                return redirect('login_student')

            except Program.DoesNotExist:
                messages.error(request, 'Selected program does not exist.')
                return redirect('register')
            except Exception as e:
                messages.error(request, f'Error creating account: {str(e)}')
                print(f"DEBUG: Exception occurred: {str(e)}")
                return redirect('register')
        else:
            # If form is invalid (including captcha), re-render with errors
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

class StudentPasswordResetConfirmView(PasswordResetConfirmView):
    def form_valid(self, form):
        response = super().form_valid(form)
        user = self.user
        try:
            student = Student.objects.get(studentID=user.username)
            log_student_activity(student=student, activity_type='PasswordReset')
        except Student.DoesNotExist:
            pass
        return response
