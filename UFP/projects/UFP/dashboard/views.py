from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages
from django.shortcuts import render, redirect
from system.models import Student, StudentFeedback, Service, Sentiment, StudentActivityLog, TeacherEvaluation, Teacher, Department, Program
from system.utils import log_student_activity
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.urls import reverse_lazy
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.admin.views.decorators import staff_member_required
from django.template.response import TemplateResponse
from django.contrib import admin
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.cache import never_cache

# ---------- Sentiment API (cards/charts) ----------
from django.http import JsonResponse
from django.db.models import Q, F, Count
from django.core.exceptions import FieldError
from warehouse.models import FactFeedback

# sa change password
from django.contrib.auth import update_session_auth_hash
from django.contrib.auth.forms import PasswordChangeForm
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password

def osas_sentiment_dashboard(request):
    """
    Returns totals and per-service sentiment for the dashboard using warehouse.FactFeedback.
    Auto-detects the service & sentiment fields (CharField or FK via common child names),
    avoids invalid lookups, and never crashes — falls back to zeros if fields cannot be found.
    """
    Model = FactFeedback

    # Helper: choose the first valid field/lookup from a list
    def pick_field(candidates):
        for f in candidates:
            try:
                # Will raise FieldError immediately if the path is invalid
                Model.objects.values_list(f, flat=True)[:1]
                return f
            except FieldError:
                continue
        return None

    # Try common possibilities for both columns (direct or FK child)
    service_field = pick_field([
        "service", "service_name", "serviceName",
        "service__name", "service__serviceName",
        "dim_service__name", "dim_service__serviceName",
        "category", "category_name",
    ])

    sentiment_field = pick_field([
        "sentiment", "sentiment_name", "sentimentName",
        "label", "value", "type", "title",
        "sentiment__name", "sentiment__sentimentName",
        "sentiment__label", "sentiment__value",
        "sentiment__type", "sentiment__title",
    ])

    # If we can't detect fields, return a benign zero payload (UI won't crash)
    if not service_field or not sentiment_field:
        zero_services = [
            {"name": "Wi-Fi Services", "positive": 0, "neutral": 0, "negative": 0, "percent_negative": 0},
            {"name": "College Admission Test", "positive": 0, "neutral": 0, "negative": 0, "percent_negative": 0},
            {"name": "Scholarship Services", "positive": 0, "neutral": 0, "negative": 0, "percent_negative": 0},
            {"name": "Library Facility", "positive": 0, "neutral": 0, "negative": 0, "percent_negative": 0},
        ]
        return JsonResponse({
            "positive": 0, "neutral": 0, "negative": 0, "total": 0,
            "positive_percent": 0, "neutral_percent": 0, "negative_percent": 0,
            "services": zero_services,
        })

    qs = Model.objects.all()

    # Count helper for sentiments (case-insensitive)
    def count_sent(qs_in, label):
        try:
            return qs_in.filter(**{f"{sentiment_field}__iexact": label}).count()
        except FieldError:
            return 0

    # Overall totals
    total_pos = count_sent(qs, "Positive")
    total_neu = count_sent(qs, "Neutral")
    total_neg = count_sent(qs, "Negative")
    total_all = total_pos + total_neu + total_neg
    pct = lambda n, d: round((n / d) * 100) if d else 0

    # Four card groups (keyword-based so minor label differences still match)
    groups = [
        ("Wi-Fi Services",        ["wi-fi", "wifi"]),
        ("College Admission Test",["admission"]),
        ("Scholarship Services",  ["scholar"]),
        ("Library Facility",      ["library"]),
    ]

    services = []
    for display_name, keywords in groups:
        q = Q()
        for kw in keywords:
            q |= Q(**{f"{service_field}__icontains": kw})
        base = qs.filter(q)

        p = count_sent(base, "Positive")
        u = count_sent(base, "Neutral")
        n = count_sent(base, "Negative")
        t = p + u + n

        services.append({
            "name": display_name,
            "positive": p,
            "neutral": u,
            "negative": n,
            "percent_negative": pct(n, t),
        })

    data = {
        "positive": total_pos,
        "neutral": total_neu,
        "negative": total_neg,
        "total": total_all,
        "positive_percent": pct(total_pos, total_all),
        "neutral_percent": pct(total_neu, total_all),
        "negative_percent": pct(total_neg, total_all),
        "services": services,
    }
    return JsonResponse(data)


# ---------- Existing dashboard / student views ----------

def _resolve_username(user):
    """Use the SAME logic used when saving TeacherEvaluation.submitted_by."""
    get_un = getattr(user, 'get_username', None)
    username = get_un() if callable(get_un) else ''
    if not username:
        username = getattr(user, 'username', '') or getattr(user, 'email', '') or ''
    if not username:
        username = str(getattr(user, 'pk', '') or user) or 'Unknown'
    return username

@login_required
def my_feedback(request):
    username = _resolve_username(request.user)

    # OSAS feedback (optional)
    feedback_list = []
    feedback_count = 0
    try:
        student = Student.objects.get(studentID=username)
        feedback_list = StudentFeedback.objects.filter(student=student).order_by('-timestamp')
        feedback_count = feedback_list.count()
    except Student.DoesNotExist:
        pass

    # Teacher evaluations submitted by this user
    teacher_evaluations = (
        TeacherEvaluation.objects
        .filter(submitted_by=username)  # <- ONLY this user's rows
        .select_related('teacher', 'department', 'program', 'sentiment')
        .annotate(teacher_name=F('teacher__teacherName'))
        .order_by('-timestamp')
    )

    return render(request, 'studentDashboard/my_feedback.html', {
        'feedback_list': feedback_list,
        'feedback_count': feedback_count,
        'teacher_evaluations': teacher_evaluations,
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
            'user_email': user_email,
            'feedback_count': feedback_count,
        }
    except Student.DoesNotExist:
        context = {
            'student': None,
            'user': request.user,
            'user_email': request.user.email,
            'feedback_count': 0,
        }
    return render(request, 'studentDashboard/profile.html', context)

@login_required
def give_feedback(request):
    cooldown_seconds = 3
    now = timezone.now()

    services = Service.objects.all().order_by('serviceName')
    try:
        student = Student.objects.get(studentID=request.user.username)
    except Student.DoesNotExist:
        messages.error(request, 'Student profile not found.')
        return render(request, 'studentDashboard/feedback_form.html', {
            'cooldown_remaining': 0,
            'services': services,
        })

    last_feedback = StudentFeedback.objects.filter(student=student).order_by('-timestamp').first()
    cooldown_remaining = max(
        0,
        cooldown_seconds - int((now - last_feedback.timestamp).total_seconds())
    ) if last_feedback else 0

    # Detect if we just logged in (message with 'login' tag)
    show_login_toast = False
    for message in messages.get_messages(request):
        if 'login' in message.tags and message.level_tag == 'success':
            show_login_toast = True
            break

    if request.method == 'POST':
        if cooldown_remaining > 0:
            messages.error(request, f"Please wait {cooldown_remaining} more seconds before submitting again.")
            return render(request, 'studentDashboard/feedback_form.html', {
                'cooldown_remaining': cooldown_remaining,
                'show_login_toast': show_login_toast,
                'services': services,
            })

        service_id = request.POST.get('service')
        feedback_text = request.POST.get('feedback')

        if not service_id or not feedback_text:
            messages.error(request, 'Please fill in all required fields.')
            return render(request, 'studentDashboard/feedback_form.html', {
                'cooldown_remaining': cooldown_remaining,
                'show_login_toast': show_login_toast,
                'services': services,
            })

        try:
            service = Service.objects.get(pk=service_id)
            StudentFeedback.objects.create(
                student=student,
                service=service,
                sentiment=None,
                comments=feedback_text
            )
            log_student_activity(student=student, activity_type='StudentProvidedFeedback')
            messages.success(request, 'Thank you for your input.')
            return redirect('give_feedback')

        except Service.DoesNotExist:
            messages.error(request, 'Selected service does not exist.')
        except Exception as e:
            messages.error(request, f'Error submitting feedback: {str(e)}')

    return render(request, 'studentDashboard/feedback_form.html', {
        'cooldown_remaining': cooldown_remaining,
        'show_login_toast': show_login_toast,
        'services': services,
    })

from system.models import TeacherEvaluation, Teacher, Department, Program
from django.shortcuts import render, redirect, get_object_or_404

def _coerce_pk_for_model(model, raw_value):
    """
    Coerce raw_value to the correct PK type for `model`:
    - If PK is integer-like, try int(); else use the raw string.
    Returns coerced value or None if blank/invalid for integer PKs.
    """
    raw = (raw_value or "").strip()
    if raw == "":
        return None

    pk_field = model._meta.pk
    pk_type = pk_field.get_internal_type()  # e.g., 'AutoField', 'BigAutoField', 'IntegerField', 'CharField'

    if pk_type in {"AutoField", "BigAutoField", "IntegerField", "SmallIntegerField", "PositiveIntegerField", "PositiveSmallIntegerField"}:
        try:
            return int(raw)
        except (TypeError, ValueError):
            return None
    else:
        # CharField / UUIDField etc. — keep as-is
        return raw


@login_required
def edit_student_profile(request):
    if request.method != 'POST':
        return redirect('profile')

    user = request.user
    posted_first = (request.POST.get('first_name') or request.POST.get('fullname') or "").strip()
    posted_email = (request.POST.get('email') or "").strip()

    changes = []
    if posted_first and posted_first != (user.first_name or ""):
        user.first_name = posted_first
        changes.append("name")
    if posted_email and posted_email != (user.email or ""):
        user.email = posted_email
        changes.append("email")

    if changes:
        user.save()
        try:
            student = Student.objects.get(studentID=user.username)
            if "name" in changes:
                student.studentName = user.first_name
            if "email" in changes:
                student.email = user.email
            student.save()
            StudentActivityLog.objects.create(student=student, activity_type='ProfileUpdated')
        except Student.DoesNotExist:
            pass
        messages.success(request, f"Profile updated: {', '.join(changes)}.")
    else:
        messages.info(request, "No changes to update.")
    return redirect('profile')

@login_required
def admin_dashboard(request):
    context = {
        'user_display_name': request.user.get_full_name() or request.user.username
    }
    return render(request, 'adminDashboard/combined-dashboard.html', context)

@login_required
@xframe_options_exempt
def osas_services(request):
    return render(request, 'adminDashboard/osas-services.html')

@staff_member_required
def admin_teachers_evaluation(request):
    """Render Teacher's Evaluation dashboard inside Unfold-themed admin shell with admin context."""
    context = {
        **admin.site.each_context(request),
        "title": "Teacher's Evaluation Dashboard",
    }
    return TemplateResponse(request, 'admin/teachers_evaluation.html', context)

@staff_member_required
def admin_osas_services(request):
    """Render OSAS Services dashboard inside Unfold-themed admin shell with admin context."""
    context = {
        **admin.site.each_context(request),
        "title": "OSAS Services Dashboard",
    }
    return TemplateResponse(request, 'admin/osas_services.html', context)


@login_required
def teacher_evaluation_dashboard(request):
    # Placeholder for teacher evaluation admin view
    return render(request, 'adminDashboard/teacher-evaluation-dashboard.html')



@login_required
def admin_reports(request):
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

    return render(request, 'adminDashboard/edit_profile.html')

@login_required
def admin_profile(request):
    if not request.user.is_staff:
        return redirect('admin_profile')
    return render(request, 'adminDashboard/adminProfile.html')

class AdminPasswordChangeView(PasswordChangeView):
    template_name = 'adminDashboard/password_change.html'
    success_url = reverse_lazy('admin_profile')

    def form_valid(self, form):
        response = super().form_valid(form)
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
                student = Student.objects.get(studentID=user.username)
                StudentActivityLog.objects.create(
                    student=student,
                    activity_type='PasswordChanged',
                )
            except Student.DoesNotExist:
                print(f"⚠ No Student record for username={user.username}")

            messages.success(request, 'Your password was changed successfully.')
            return redirect('profile')

    return render(request, 'studentDashboard/change_password.html')


@login_required
def teacher_evaluation(request):
    cooldown_seconds = 3
    now = timezone.now()

    teachers = Teacher.objects.all()
    departments = Department.objects.all()
    programs = Program.objects.all()
    sentiments = Sentiment.objects.all()

    try:
        student = Student.objects.get(studentID=request.user.username)
    except Student.DoesNotExist:
        messages.error(request, 'Student profile not found.')
        return render(request, 'studentDashboard/teacher_evaluation_form.html', {
            'teachers': teachers,
            'departments': departments,
            'programs': programs,
            'sentiments': sentiments,
            'cooldown_remaining': 0,
        })

    # --- Refactored cooldown logic (same as give_feedback) ---
    last_evaluation = TeacherEvaluation.objects.filter(submitted_by=request.user.username).order_by('-timestamp').first()
    cooldown_remaining = max(
        0,
        cooldown_seconds - int((now - last_evaluation.timestamp).total_seconds())
    ) if last_evaluation else 0
    # ---------------------------------------------------------

    if request.method == 'POST':
        comments       = request.POST.get('comments')
        teacher_id     = request.POST.get('teacher')
        department_id  = request.POST.get('department')
        # program/specialization/sentiment are optional now (template no longer sends them)
        sentiment_id   = request.POST.get('sentiment')

        is_anonymous = 'is_anonymous' in request.POST
        username = _resolve_username(request.user)  # store this ALWAYS

        # Basic required fields: comments, teacher, department
        if comments and teacher_id and department_id:
            # Attempt to derive program from the selected teacher if available
            program_obj = None
            try:
                teacher_obj = Teacher.objects.get(pk=teacher_id)
                program_obj = getattr(teacher_obj, 'program', None)
            except Teacher.DoesNotExist:
                teacher_obj = None

            TeacherEvaluation.objects.create(
                comments=comments,
                teacher_id=teacher_id,
                department_id=department_id,
                program=program_obj,
                specialization=None,
                sentiment_id=sentiment_id or None,
                is_anonymous=is_anonymous,
                submitted_by=username,           # <- key for filtering later
                timestamp=timezone.now(),
            )
            try:
                student = Student.objects.get(studentID=request.user.username)
                log_student_activity(
                    student=student,
                    activity_type='StudentProvidedFeedback'
                )
            except Student.DoesNotExist:
                pass
            messages.success(request, 'Your evaluation has been submitted successfully!')
            return redirect('teacher_evaluation')
        else:
            messages.error(request, 'Please fill in all required fields.')

    return render(request, 'studentDashboard/teacher_evaluation_form.html', {
        'teachers': teachers,
        'departments': departments,
        'programs': programs,
        'sentiments': sentiments,
        'cooldown_remaining': cooldown_remaining,
    })

from system.models import Service
@login_required
@never_cache
def feedback_form_view(request):
    services = Service.objects.all().order_by('serviceName')
    return render(request, 'studentDashboard/feedback_form.html', {'services': services})
