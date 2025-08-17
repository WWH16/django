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
        if form.is_valid():  # Validates captcha too
            student_id = form.cleaned_data['student_id']
            password = form.cleaned_data['password']
            remember = request.POST.get('remember') == 'on'

            user = authenticate(request, username=student_id, password=password)

            if user and user.is_active and not user.is_staff:
                auth_login(request, user)

                # Log student login activity
                try:
                    student = Student.objects.get(studentID=user.username)
                    log_student_activity(
                        student=student,
                        activity_type='StudentLoggedIn'
                    )
                except Student.DoesNotExist:
                    pass

                if remember:
                    request.session.set_expiry(604800)  # 7 days
                else:
                    request.session.set_expiry(0)  # Browser close

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
            pass
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
            if len(password) < 8:
                messages.error(request, 'Password must be at least 8 characters long.')
                return redirect('register')

            if not re.search(r'\d', password):
                messages.error(request, 'Password must contain at least one number.')
                return redirect('register')

            # Existing validation checks
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
                    activity_type='StudentProvidedFeedback'
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
    
# sa pag export ng teacher evaluation as csv per teacher
from django.db.models import Count, Q, F, Subquery, OuterRef
from warehouse.models import fact_teacher_evaluation as Eval
from system.models import Teacher
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import JsonResponse

def teacher_performance_by_teacher(request):
    # Join to get the display name from system_teacher (teacherName)
    name_sq = Subquery(
        Teacher.objects
        .filter(teacher_id=OuterRef('teacher_id'))
        .values('teacherName')[:1]
    )

    qs = (
        Eval.objects
        .values('teacher_id')
        .annotate(
            teacher_name=name_sq,
            positive=Count('evaluation_id', filter=Q(sentiment_id=1)),
            negative=Count('evaluation_id', filter=Q(sentiment_id=2)),
            neutral =Count('evaluation_id', filter=Q(sentiment_id=3)),
            total=Count('evaluation_id'),
        )
        .order_by('teacher_name', 'teacher_id')
    )

    data = [{
        "teacher": r.get("teacher_name") or r["teacher_id"],
        "positive": int(r["positive"] or 0),
        "neutral":  int(r["neutral"]  or 0),
        "negative": int(r["negative"] or 0),
        "total":    int(r["total"]    or 0),
    } for r in qs]

    return JsonResponse(data, safe=False)