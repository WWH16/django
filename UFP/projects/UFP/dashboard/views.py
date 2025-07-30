from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from system.models import Student, StudentFeedback, Service, Sentiment, StudentActivityLog
from system.utils import log_student_activity
from django.contrib import messages


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
@login_required
def give_feedback(request):
    if request.method == 'POST':
        # Debug: Print user info and all student IDs
        print('DEBUG: request.user:', request.user)
        print('DEBUG: request.user.username:', getattr(request.user, 'username', None))
        from system.models import Student
        print('DEBUG: All Student IDs:', list(Student.objects.values_list('studentID', flat=True)))
        # Get form data
        service_name = request.POST.get('service')
        feedback_text = request.POST.get('feedback')
        # sentiment = request.POST.get('sentiment', 'Neutral')  # Remove this line, do not use sentiment from form
        
        if not service_name or not feedback_text:
            messages.error(request, 'Please fill in all required fields.')
            return render(request, 'studentDashboard/feedback_form.html')
        
        try:
            # Get the current student
            student = Student.objects.get(studentID=request.user.username)
            
            # Get or create service
            service, created = Service.objects.get_or_create(
                serviceName=service_name
            )
            
            # Create feedback with sentiment=None
            feedback = StudentFeedback.objects.create(
                student=student,
                service=service,
                sentiment=None,
                comments=feedback_text
            )
            
            # Log the activity
            log_student_activity(
                student=student,
                activity_type='Feedback Submit'
            )
            
            messages.success(request, 'Feedback submitted successfully! Thank you for your input.')
            return redirect('my_feedback')
            
        except Student.DoesNotExist:
            messages.error(request, 'Student profile not found.')
        except Exception as e:
            messages.error(request, f'Error submitting feedback: {str(e)}')
    
    # GET request - show the form   
    return render(request, 'studentDashboard/feedback_form.html')

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

