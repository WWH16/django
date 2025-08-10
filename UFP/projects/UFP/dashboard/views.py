from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from django.shortcuts import render, redirect
from system.models import Student, StudentFeedback, Service, Sentiment, StudentActivityLog
from system.utils import log_student_activity
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.urls import reverse_lazy
from datetime import timedelta
from django.utils import timezone


@login_required
def my_feedback(request):
    try:
        student = Student.objects.get(studentID=request.user.username)
        feedback_list = StudentFeedback.objects.filter(student=student).order_by('-timestamp')
        feedback_count = feedback_list.count()
        context = {
            'feedback_list': feedback_list,
            'feedback_count': feedback_count,
        }
        return render(request, 'studentDashboard/my_feedback.html', context)
    except Student.DoesNotExist:
        return render(request, 'studentDashboard/my_feedback.html', {
            'feedback_list': [],
            'feedback_count': 0,
        })

@login_required
def profile(request):
    try:
        student = Student.objects.get(studentID=request.user.username)
        feedback_count = StudentFeedback.objects.filter(student=student).count()
        # Fallback: use student.email if user.email is empty
        user_email = request.user.email or student.email
        context = {
            'student': student,
            'user': request.user,
            'user_email': user_email,  # Use this in the template
            'feedback_count': feedback_count,
        }
        return render(request, 'studentDashboard/profile.html', context)
    except Student.DoesNotExist:
        context = {
            'student': None,

            'user': request.user,
            'user_email': request.user.email,  # Only user.email available
            'feedback_count': 0,
        }
        return render(request, 'studentDashboard/profile.html', context)

def give_feedback(request):
    cooldown_seconds = 10
    now = timezone.now()

    # Your debug prints and student fetching - preserved as is
    print('DEBUG: request.user:', request.user)
    print('DEBUG: request.user.username:', getattr(request.user, 'username', None))
    print('DEBUG: All Student IDs:', list(Student.objects.values_list('studentID', flat=True)))

    try:
        student = Student.objects.get(studentID=request.user.username)
    except Student.DoesNotExist:
        messages.error(request, 'Student profile not found.')
        return render(request, 'studentDashboard/feedback_form.html', {'cooldown_remaining': 0})

    last_feedback = StudentFeedback.objects.filter(student=student).order_by('-timestamp').first()

    cooldown_remaining = 0
    if last_feedback:
        elapsed = (now - last_feedback.timestamp).total_seconds()
        if elapsed < cooldown_seconds:
            cooldown_remaining = int(cooldown_seconds - elapsed)  # Ensure integer here

    if request.method == 'POST':
        if cooldown_remaining > 0:
            messages.error(request, f"Please wait {cooldown_remaining} more seconds before submitting again.")
            return render(request, 'studentDashboard/feedback_form.html', {'cooldown_remaining': cooldown_remaining})

        # The rest of your POST logic preserved exactly
        service_name = request.POST.get('service')
        feedback_text = request.POST.get('feedback')

        if not service_name or not feedback_text:
            messages.error(request, 'Please fill in all required fields.')
            return render(request, 'studentDashboard/feedback_form.html', {'cooldown_remaining': 0})

        try:
            service, _ = Service.objects.get_or_create(serviceName=service_name)

            StudentFeedback.objects.create(
                student=student,
                service=service,
                sentiment=None,
                comments=feedback_text
            )

            log_student_activity(student=student, activity_type='Feedback Submit')

            messages.success(request, 'Feedback submitted successfully! Thank you for your input.')
            return redirect('my_feedback')

        except Exception as e:
            messages.error(request, f'Error submitting feedback: {str(e)}')
            return render(request, 'studentDashboard/feedback_form.html', {'cooldown_remaining': 0})

    # GET request — preserved as is, just ensure cooldown_remaining is int
    return render(request, 'studentDashboard/feedback_form.html', {'cooldown_remaining': cooldown_remaining})


@login_required
def edit_student_profile(request):
    if request.method == 'POST':
        user = request.user
        first_name = request.POST.get('first_name')
        email = request.POST.get('email')
        # Update user fields
        user.first_name = first_name
        user.email = email
        user.save()
        # Log activity in StudentActivityLog and sync studentName and email
        try:
            student = Student.objects.get(studentID=user.username)
            student.studentName = first_name  # Sync full name
            student.email = email  # Sync email
            student.save()
            StudentActivityLog.objects.create(
                student=student,
                activity_type='Profile updated.'
            )
        except Student.DoesNotExist:
            pass
        messages.success(request, 'Profile updated successfully!')
    return redirect('profile')

@login_required
def admin_dashboard(request):
    context = {
        'user_display_name': request.user.get_full_name() or request.user.username
    }
    return render(request, 'adminDashboard/combined-dashboard.html', context)

@login_required
def osas_services(request):
    # Placeholder for OSAS services view
    return render(request, 'adminDashboard/osas-services.html')

@login_required
def teacher_evaluation(request):
    # Placeholder for teacher evaluation admin view
    return render(request, 'adminDashboard/teacher-evaluation.html')

@login_required 
def admin_reports(request):
    # Placeholder for admin reports view
    return render(request, 'adminDashboard/table.html')

@login_required
def edit_admin_profile(request):
    if not request.user.is_staff:
        return redirect('admin_profile')
    if request.method == 'POST':
        user = request.user
        first_name = request.POST.get('first_name')
        last_name = request.POST.get('last_name')
        email = request.POST.get('email')
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.save()
        LogEntry.objects.log_action(
            user_id=user.pk,
            content_type_id=ContentType.objects.get_for_model(User).pk,
            object_id=user.pk,
            object_repr=str(user),
            action_flag=CHANGE,
            change_message="Admin updated their profile."
        )
        messages.success(request, 'Profile updated successfully!')
        return redirect('admin_profile')
    # Render the edit form for GET requests
    return render(request, 'adminDashboard/edit_profile.html')

@login_required
def admin_profile(request):
    if not request.user.is_staff:
        return redirect('profile')  # or another appropriate page for non-admins
    return render(request, 'adminDashboard/adminProfile.html')

class AdminPasswordChangeView(PasswordChangeView):
    template_name = 'adminDashboard/password_change.html'
    success_url = reverse_lazy('admin_profile')

    def form_valid(self, form):
        response = super().form_valid(form)
        # Log the password change
        LogEntry.objects.log_action(
            user_id=self.request.user.pk,
            content_type_id=ContentType.objects.get_for_model(User).pk,
            object_id=self.request.user.pk,
            object_repr=str(self.request.user),
            action_flag=CHANGE,
            change_message="Admin changed their password."
        )
        return response

@login_required
def admin_activity_log(request):
    if not request.user.is_staff:
        return redirect('admin_profile')
    logs = LogEntry.objects.filter(user=request.user).order_by('-action_time')[:50]
    return render(request, 'adminDashboard/admin_activity_log.html', {'logs': logs})

@login_required
def change_password(request):
    if request.method == 'POST':
        old_password = request.POST.get('old_password')
        new_password1 = request.POST.get('new_password1')
        new_password2 = request.POST.get('new_password2')
        user = request.user

        if not user.check_password(old_password):
            messages.error(request, 'Current password is incorrect.')
        elif new_password1 != new_password2:
            messages.error(request, 'New passwords do not match.')
        elif not new_password1:
            messages.error(request, 'New password cannot be empty.')
        else:
            user.set_password(new_password1)
            user.save()
            update_session_auth_hash(request, user)  # Keep user logged in

            # Log the password change
            try:
                student = Student.objects.get(email=user.email)
                StudentActivityLog.objects.create(
                    student=student,
                    activity_type='Student changed password.',
                )
            except Student.DoesNotExist:
                pass  # Optionally handle if student record not found

            messages.success(request, 'Your password was changed successfully.')
            return redirect('profile')
    return render(request, 'studentDashboard/change_password.html')