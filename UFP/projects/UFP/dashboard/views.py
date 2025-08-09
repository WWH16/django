from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from system.models import Student, StudentFeedback, Service, Sentiment, StudentActivityLog
from system.utils import log_student_activity
from django.contrib import messages
from django.contrib.admin.models import LogEntry, CHANGE
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User
from django.contrib.auth.views import PasswordChangeView
from django.urls import reverse_lazy

# ---------- Sentiment API (cards/charts) ----------
from django.http import JsonResponse
from django.db.models import Q
from django.core.exceptions import FieldError
from warehouse.models import FactFeedback


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
            'user_email': user_email,
            'feedback_count': feedback_count,
        }
        return render(request, 'studentDashboard/profile.html', context)
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
    if request.method == 'POST':
        # Debug prints
        print('DEBUG: request.user:', request.user)
        print('DEBUG: request.user.username:', getattr(request.user, 'username', None))
        from system.models import Student as StudentModel
        print('DEBUG: All Student IDs:', list(StudentModel.objects.values_list('studentID', flat=True)))

        service_name = request.POST.get('service')
        feedback_text = request.POST.get('feedback')

        if not service_name or not feedback_text:
            messages.error(request, 'Please fill in all required fields.')
            return render(request, 'studentDashboard/feedback_form.html')

        try:
            student = Student.objects.get(studentID=request.user.username)

            service, created = Service.objects.get_or_create(serviceName=service_name)

            # Store with sentiment=None; sentiment will be computed elsewhere
            StudentFeedback.objects.create(
                student=student,
                service=service,
                sentiment=None,
                comments=feedback_text
            )

            log_student_activity(student=student, activity_type='Feedback Submit')
            messages.success(request, 'Feedback submitted successfully! Thank you for your input.')
            return redirect('my_feedback')

        except Student.DoesNotExist:
            messages.error(request, 'Student profile not found.')
        except Exception as e:
            messages.error(request, f'Error submitting feedback: {str(e)}')

    return render(request, 'studentDashboard/feedback_form.html')

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
def give_evaluation(request):
    if request.method == "POST":
        teacher_raw = (request.POST.get("teacher_id") or "").strip()
        dept_raw    = (request.POST.get("department_id") or "").strip()
        prog_raw    = (request.POST.get("program_id") or "").strip()
        comments    = (request.POST.get("comments") or "").strip()
        # anonymous checkbox may exist in UI, but the model has no field for it

        errors = []

        # Validate numeric IDs expected by FK fields
        try:
            teacher = Teacher.objects.get(pk=int(teacher_raw))
        except Exception:
            teacher = None
            errors.append("Please select a valid teacher.")

        try:
            department = Department.objects.get(pk=int(dept_raw))
        except Exception:
            department = None
            errors.append("Please select a valid department.")

        try:
            program = Program.objects.get(pk=int(prog_raw))
        except Exception:
            program = None
            errors.append("Please select a valid program.")

        if not comments:
            errors.append("Please enter your feedback in the comments field.")

        if errors:
            for e in errors:
                messages.error(request, e)
            return render(
                request,
                "studentDashboard/give_evaluation.html",
                {
                    "teachers": Teacher.objects.order_by("teacherName"),
                    "departments": Department.objects.order_by("departmentName"),
                    "programs": Program.objects.order_by("programName"),
                    "form_data": request.POST,  # preserve user selections
                },
            )

        # Create WITHOUT 'anonymous' because the model doesn't have that field
        TeacherEvaluation.objects.create(
            teacher_id=teacher.pk,
            department_id=department.pk,
            program_id=program.pk,
            comments=comments,
        )

        messages.success(request, "Thanks! Your evaluation was submitted.")
        return redirect("give_evaluation")

    # GET
    return render(
        request,
        "studentDashboard/give_evaluation.html",
        {
            "teachers": Teacher.objects.order_by("teacherName"),
            "departments": Department.objects.order_by("departmentName"),
            "programs": Program.objects.order_by("programName"),
        },
    )


@login_required
def edit_student_profile(request):
    if request.method == 'POST':
        user = request.user
        first_name = request.POST.get('first_name')
        email = request.POST.get('email')

        user.first_name = first_name
        user.email = email
        user.save()

        try:
            student = Student.objects.get(studentID=user.username)
            student.studentName = first_name
            student.email = email
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
    return render(request, 'adminDashboard/osas-services.html')

@login_required
def teacher_evaluation(request):
    return render(request, 'adminDashboard/teacher-evaluation.html')

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