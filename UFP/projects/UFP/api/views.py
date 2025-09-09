from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q, F, Subquery, OuterRef
from django.db.models.functions import TruncDate, ExtractYear
from django.http import JsonResponse

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination

from system.models import StudentFeedback, Teacher
from warehouse.models import (
    FactFeedback,
    fact_teacher_evaluation as Eval,
    dim_teacher,
)
from .serializers import (
    FactFeedbackSerializer,
    TeacherEvaluationSerializer,
)

# ============================================================
# Student Feedback APIs
# ============================================================

@api_view(['GET', 'POST'])
def feedback_list(request):
    if request.method == 'GET':
        feedbacks = StudentFeedback.objects.all()
        serializer = StudentFeedbackSerializer(feedbacks, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = StudentFeedbackSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def fact_feedback_list(request):
    paginator = PageNumberPagination()
    paginator.page_size = int(request.GET.get('page_size', 10))
    feedbacks = FactFeedback.objects.select_related('student', 'service', 'sentiment').all()
    result_page = paginator.paginate_queryset(feedbacks, request)
    serializer = FactFeedbackSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)

# ============================================================
# Teacher Evaluation APIs
# ============================================================

@api_view(['GET'])
def teacher_evaluation_list(request):
    paginator = PageNumberPagination()
    paginator.page_size = int(request.GET.get('page_size', 10))
    evaluations = Eval.objects.select_related('teacher', 'student', 'sentiment').all()
    result_page = paginator.paginate_queryset(evaluations, request)
    serializer = TeacherEvaluationSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
def teacher_evaluation_dashboard_stats(request):
    qs = Eval.objects.all()
    total = qs.count()
    positive = qs.filter(sentiment__label='Positive').count()
    neutral = qs.filter(sentiment__label='Neutral').count()
    negative = qs.filter(sentiment__label='Negative').count()
    return Response({
        "total": total,
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "positive_percent": round(positive/total*100) if total else 0,
        "neutral_percent": round(neutral/total*100) if total else 0,
        "negative_percent": round(negative/total*100) if total else 0,
    })


@api_view(['GET'])
def recent_teacher_evaluations(request):
    """
    Get most recent teacher evaluations with teacher name, program, sentiment, and comments
    """
    limit = int(request.GET.get('limit', 5))  
    evaluations = (
        Eval.objects
        .select_related('teacher', 'sentiment')
        .order_by('-timestamp')[:max(1, min(limit, 20))]
    )
    data = []
    for e in evaluations:
        teacher_name = "Unknown Teacher"
        program_name = None
        if e.teacher:
            teacher_name = e.teacher.teacher_name or f"Teacher ID: {e.teacher.teacher_id}"
            program_name = getattr(e.teacher, 'program_name', None)

        sentiment_label = e.sentiment.label if e.sentiment else "Unknown"
        comments = e.comments or "No comments provided"
        if len(comments) > 150:
            comments = comments[:150] + "..."
        data.append({
            "teacher": teacher_name,
            "program": program_name,
            "sentiment": sentiment_label,
            "comments": comments,
            "timestamp": e.timestamp,
        })
    return Response(data)


@api_view(['GET'])
def teacher_performance_by_program(request):
    """
    Returns bar chart data grouped by program.
    Matches frontend expectation: { "programs": [...] }
    Supports filters ?year=2025&semester=1
    """
    year = request.GET.get("year")
    semester = request.GET.get("semester")

    evaluations = Eval.objects.select_related("teacher")

    # Year filter
    if year:
        try:
            evaluations = evaluations.filter(timestamp__year=int(year))
        except ValueError:
            return Response({"error": "Invalid year format"}, status=400)

    # Semester filter (1 = Jan–Jun, 2 = Jul–Dec)
    if semester == "1":
        evaluations = evaluations.filter(timestamp__month__gte=1, timestamp__month__lte=6)
    elif semester == "2":
        evaluations = evaluations.filter(timestamp__month__gte=7, timestamp__month__lte=12)

    grouped = (
        evaluations
        .values("teacher__program_name")
        .annotate(
            positive=Count("evaluation_id", filter=Q(sentiment__label="Positive")),
            neutral=Count("evaluation_id", filter=Q(sentiment__label="Neutral")),
            negative=Count("evaluation_id", filter=Q(sentiment__label="Negative")),
            total=Count("evaluation_id"),
        )
        .order_by("teacher__program_name")
    )

    programs = []
    for g in grouped:
        programs.append({
            "name": g["teacher__program_name"] or "Unknown",
            "positive": g["positive"] or 0,
            "neutral": g["neutral"] or 0,
            "negative": g["negative"] or 0,
            "total": g["total"] or 0,
        })

    return Response({"programs": programs})


@api_view(['GET'])
def teacher_improvement_priority(request):
    teachers = dim_teacher.objects.all()
    priority_list = []
    for teacher in teachers:
        evaluations = Eval.objects.filter(teacher=teacher)
        total = evaluations.count()
        if total == 0:
            continue
        negative = evaluations.filter(sentiment__label='Negative').count()
        percent_negative = round((negative / total) * 100)
        if percent_negative >= 25:
            priority = 'Urgent'
        elif percent_negative >= 15:
            priority = 'Medium'
        elif percent_negative >= 10:
            priority = 'Low'
        else:
            priority = None
        if priority:
            priority_list.append({
                "teacher": teacher.teacher_name,
                "program": teacher.program_name,
                "priority": priority,
                "percent_negative": percent_negative
            })
    priority_list.sort(key=lambda x: x['percent_negative'], reverse=True)
    return Response(priority_list)


# Teacher performance export per teacher
@api_view(['GET'])
def teacher_performance_by_teacher(request):
    year = request.GET.get("year")
    semester = request.GET.get("semester")
    evals = Eval.objects.all()

    if year:
        try:
            year = int(year)
            evals = evals.filter(timestamp__year=year)
        except ValueError:
            pass  

    if semester:
        if semester == "1":
            evals = evals.filter(timestamp__month__gte=1, timestamp__month__lte=6)
        elif semester == "2":
            evals = evals.filter(timestamp__month__gte=7, timestamp__month__lte=12)

    name_sq = Subquery(
        Teacher.objects.filter(teacher_id=OuterRef("teacher_id")).values("teacherName")[:1]
    )

    qs = (
        evals.values("teacher_id")
        .annotate(
            teacher_name=name_sq,
            positive=Count("evaluation_id", filter=Q(sentiment__label="Positive")),
            negative=Count("evaluation_id", filter=Q(sentiment__label="Negative")),
            neutral=Count("evaluation_id", filter=Q(sentiment__label="Neutral")),
            total=Count("evaluation_id"),
        )
        .order_by("teacher_name", "teacher_id")
    )

    data = [{
        "teacher": r.get("teacher_name") or r["teacher_id"],
        "positive": int(r["positive"] or 0),
        "neutral": int(r["neutral"] or 0),
        "negative": int(r["negative"] or 0),
        "total": int(r["total"] or 0),
    } for r in qs]

    return JsonResponse(data, safe=False)


# Group by program with semester filter
@api_view(['GET'])
def teacher_evaluation_by_semester(request):
    year = request.GET.get("year")
    program = request.GET.get("program")  
    semester = request.GET.get("semester")  
    all_time = request.GET.get("all_time", "false").lower() == "true"

    # Handle "all time" case
    if all_time:
        evaluations = Eval.objects.select_related("teacher")
    else:
        if not year:
            return Response({"error": "Missing required parameter: year"}, status=400)

        try:
            year = int(year)
        except ValueError:
            return Response({"error": "Invalid year format"}, status=400)

        evaluations = (
            Eval.objects.annotate(evaluation_year=ExtractYear("timestamp"))
            .filter(evaluation_year=year)
            .select_related("teacher")
        )

    if semester:
        if semester == '1':  
            evaluations = evaluations.filter(timestamp__month__gte=8, timestamp__month__lte=12)
        elif semester == '2':  
            evaluations = evaluations.filter(timestamp__month__gte=1, timestamp__month__lte=5)

    if program:
        evaluations = evaluations.filter(teacher__program_name=program)

    grouped = (
        evaluations.values('teacher__program_name')
        .annotate(
            program_name=F('teacher__program_name'),
            positive=Count('evaluation_id', filter=Q(sentiment__label='Positive')),
            neutral=Count('evaluation_id', filter=Q(sentiment__label='Neutral')),
            negative=Count('evaluation_id', filter=Q(sentiment__label='Negative')),
            total=Count('evaluation_id'),
        )
        .order_by('program_name')
    )

    results = []
    for r in grouped:
        total = r['total'] or 1
        results.append({
            "name": r.get("program_name") or "Unknown Program",
            "positive": r["positive"] or 0,
            "neutral": r["neutral"] or 0, 
            "negative": r["negative"] or 0,
            "total": r["total"] or 0,
            "positive_percent": round((r["positive"] / total) * 100) if r["total"] else 0,
            "neutral_percent": round((r["neutral"] / total) * 100) if r["total"] else 0,
            "negative_percent": round((r["negative"] / total) * 100) if r["total"] else 0,
        })

    return Response({
        "year": year,
        "semester": semester,
        "program": program,
        "programs": results
    })# ========================
# Teacher Evaluation APIs
# ========================

@api_view(['GET'])
def teacher_evaluation_list(request):
    paginator = PageNumberPagination()
    paginator.page_size = int(request.GET.get('page_size', 10))
    evaluations = Eval.objects.select_related('teacher', 'student', 'sentiment').all()
    result_page = paginator.paginate_queryset(evaluations, request)
    serializer = TeacherEvaluationSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)


@api_view(['GET'])
def teacher_evaluation_dashboard_stats(request):
    qs = Eval.objects.all()
    total = qs.count()
    positive = qs.filter(sentiment__label='Positive').count()
    neutral = qs.filter(sentiment__label='Neutral').count()
    negative = qs.filter(sentiment__label='Negative').count()
    return Response({
        "total": total,
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "positive_percent": round(positive/total*100) if total else 0,
        "neutral_percent": round(neutral/total*100) if total else 0,
        "negative_percent": round(negative/total*100) if total else 0,
    })


@api_view(['GET'])
def recent_teacher_evaluations(request):
    limit = int(request.GET.get('limit', 5))
    evaluations = (
        Eval.objects
        .select_related('teacher', 'sentiment')
        .order_by('-timestamp')[:max(1, min(limit, 20))]
    )

    data = []
    for e in evaluations:
        teacher_name = getattr(e.teacher, 'teacher_name', f"Teacher {e.teacher_id}")
        program_name = getattr(e.teacher, 'program_name', None)
        sentiment_label = getattr(e.sentiment, 'label', 'Unknown')
        comments = e.comments or "No comments provided"
        if len(comments) > 150:
            comments = comments[:150] + "..."
        data.append({
            "teacher": teacher_name,
            "program": program_name,
            "sentiment": sentiment_label,
            "comments": comments,
            "timestamp": e.timestamp,
        })
    return Response(data)


@api_view(['GET'])
def teacher_performance_by_program(request):
    """
    Returns bar chart data grouped by program.
    Matches frontend expectation: { "programs": [...] }
    Supports filters ?year=2025&semester=1
    """
    year = request.GET.get("year")
    semester = request.GET.get("semester")

    evaluations = Eval.objects.select_related("teacher")

    # Year filter
    if year:
        try:
            year = int(year)
            evaluations = evaluations.annotate(y=ExtractYear("timestamp")).filter(y=year)
        except ValueError:
            pass

    # Semester filter (1 = Jan–Jun, 2 = Jul–Dec)
    if semester == "1":
        evaluations = evaluations.filter(timestamp__month__gte=1, timestamp__month__lte=6)
    elif semester == "2":
        evaluations = evaluations.filter(timestamp__month__gte=7, timestamp__month__lte=12)

    grouped = (
        evaluations
        .values("teacher__program_name")
        .annotate(
            program_name=F("teacher__program_name"),
            positive=Count("evaluation_id", filter=Q(sentiment__label="Positive")),
            neutral=Count("evaluation_id", filter=Q(sentiment__label="Neutral")),
            negative=Count("evaluation_id", filter=Q(sentiment__label="Negative")),
            total=Count("evaluation_id"),
        )
        .order_by("program_name")
    )

    programs = []
    for g in grouped:
        programs.append({
            "name": g["program_name"] or "Unknown",
            "positive": g["positive"] or 0,
            "neutral": g["neutral"] or 0,
            "negative": g["negative"] or 0,
            "total": g["total"] or 0,
        })

    return Response({"programs": programs})


@api_view(['GET'])
def teacher_improvement_priority(request):
    teachers = dim_teacher.objects.all()
    priority_list = []
    for teacher in teachers:
        evaluations = Eval.objects.filter(teacher=teacher)
        total = evaluations.count()
        if total == 0:
            continue
        negative = evaluations.filter(sentiment__label='Negative').count()
        percent_negative = round((negative / total) * 100)
        if percent_negative >= 25:
            priority = 'Urgent'
        elif percent_negative >= 15:
            priority = 'Medium'
        elif percent_negative >= 10:
            priority = 'Low'
        else:
            priority = None
        if priority:
            priority_list.append({
                "teacher": teacher.teacher_name,
                "program": teacher.program_name,
                "priority": priority,
                "percent_negative": percent_negative
            })
    priority_list.sort(key=lambda x: x['percent_negative'], reverse=True)
    return Response(priority_list)


# ============================================================
# OSAS Sentiment Dashboard APIs
# ============================================================

@api_view(["GET"])
def osas_sentiment_dashboard(request):
    key = (request.GET.get("range") or "all").lower()
    def as_date(s):
        try:
            return datetime.strptime(s, "%Y-%m-%d").date()
        except Exception:
            return None

    start = as_date(request.GET.get("start"))
    end   = as_date(request.GET.get("end"))
    today = timezone.localdate()

    if not start and not end:
        if key == "7d": start, end = today - timedelta(days=6), today
        elif key == "30d": start, end = today - timedelta(days=29), today
        elif key == "this_month": start, end = today.replace(day=1), today
        elif key == "6m": start, end = today - timedelta(days=182), today
        elif key == "1y": start, end = today - timedelta(days=365), today
        else: start, end = None, None
    if start and not end: end = today
    if end and not start: start = today

    qs = FactFeedback.objects.select_related("service", "sentiment")
    if start and end:
        qs = qs.annotate(d=TruncDate("timestamp")).filter(d__gte=start, d__lte=end)

    total = qs.count()
    positive = qs.filter(sentiment__label='Positive').count()
    neutral  = qs.filter(sentiment__label='Neutral').count()
    negative = qs.filter(sentiment__label='Negative').count()
    pct = (lambda n, d: round((n/d)*100) if d else 0)

    per_service = (
        qs.values("service__service_name")
        .annotate(
            p=Count("pk", filter=Q(sentiment__label='Positive')),
            u=Count("pk", filter=Q(sentiment__label='Neutral')),
            n=Count("pk", filter=Q(sentiment__label='Negative')),
        )
        .order_by("service__service_name")
    )

    services = []
    for row in per_service:
        name = row.get("service__service_name") or "Unknown"
        p, u, n = int(row["p"] or 0), int(row["u"] or 0), int(row["n"] or 0)
        t = p + u + n
        services.append({
            "name": name,
            "positive": p,
            "neutral": u,
            "negative": n,
            "satisfaction": pct(p, t),
            "percent_negative": pct(n, t),
        })

    return Response({
        "range": key,
        "start": start.isoformat() if start else None,
        "end":   end.isoformat()   if end   else None,
        "total": total,
        "positive": positive,
        "neutral":  neutral,
        "negative": negative,
        "positive_percent": pct(positive, total),
        "neutral_percent":  pct(neutral, total),
        "negative_percent": pct(negative, total),
        "services": services,
    })


@api_view(['GET'])
def recent_osas_feedback(request):
    limit = int(request.GET.get('limit', 3))
    qs = (
        FactFeedback.objects
        .select_related('service', 'sentiment')
        .order_by('-timestamp')[:max(1, min(limit, 20))]
    )
    def pick(obj, *paths):
        for p in paths:
            try:
                v = obj
                for attr in p.split('__'):
                    v = getattr(v, attr, None)
                    if v is None: break
                if v: return str(v)
            except Exception: pass
        return None

    data = []
    for f in qs:
        service_name = (
            pick(f, 'service__service_name', 'service__name', 'service__serviceName') or
            pick(f, 'category', 'category_name', 'service') or 'Unknown'
        )
        sentiment_label = pick(f, 'sentiment__label', 'sentiment__name', 'sentiment__value') or 'Unknown'
        comments = pick(f, 'comments', 'comment', 'feedback', 'feedback_text', 'text', 'content', 'message', 'remarks') or ''
        data.append({
            "service": service_name,
            "sentiment": sentiment_label,
            "comments": comments,
        })
    return Response(data)

@api_view(['GET'])
def service_feedback_by_semester(request, semester_slug=None):
    year = request.GET.get("year")
    all_time = request.GET.get("all_time", "false").lower() == "true"

    # Map slug to numeric semester
    semester_map = {
        "1st-semester": "1",
        "2nd-semester": "2",
    }
    # Accept either slug or query param (?semester=1|2)
    semester = semester_map.get(semester_slug) if semester_slug else request.GET.get("semester")

    # Base queryset with joins for efficiency
    feedbacks = FactFeedback.objects.select_related("service", "sentiment")

    if not all_time:
        if not year:
            return Response({"error": "Missing required parameter: year"}, status=400)

        try:
            year = int(year)
        except ValueError:
            return Response({"error": "Invalid year format"}, status=400)

        feedbacks = feedbacks.annotate(feedback_year=ExtractYear("timestamp")).filter(feedback_year=year)

    # Semester filtering (Aug–Dec = 1st; Jan–May = 2nd)
    if semester in ("1", "2"):
        if semester == "1":
            feedbacks = feedbacks.filter(timestamp__month__gte=8, timestamp__month__lte=12)
        else:  # "2"
            feedbacks = feedbacks.filter(timestamp__month__gte=1, timestamp__month__lte=5)
    elif semester is not None:
        # Invalid semester value supplied
        return Response({"error": "Invalid semester. Use '1st-semester', '2nd-semester' or ?semester=1|2."}, status=400)

    # Group by the related service name on the dimension table
    grouped = (
        feedbacks.values("service__service_name")
        .annotate(
            service_name=F("service__service_name"),
            positive=Count("feedback_id", filter=Q(sentiment__label="Positive")),
            neutral=Count("feedback_id", filter=Q(sentiment__label="Neutral")),
            negative=Count("feedback_id", filter=Q(sentiment__label="Negative")),
            total=Count("feedback_id"),
        )
        .order_by("service__service_name")
    )

    results = []
    for r in grouped:
        total = r["total"] or 0
        denom = total if total else 1  # avoid zero-division
        results.append({
            "service": r.get("service_name") or "Unknown Service",
            "positive": r["positive"] or 0,
            "neutral": r["neutral"] or 0,
            "negative": r["negative"] or 0,
            "total": total,
            "positive_percent": round((r["positive"] / denom) * 100) if total else 0,
            "neutral_percent": round((r["neutral"] / denom) * 100) if total else 0,
            "negative_percent": round((r["negative"] / denom) * 100) if total else 0,
        })

    return Response({
        "year": year if not all_time else "all",
        "semester": semester,
        "program": None,
        "services": results
    })

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
import os
from openai import OpenAI

client = OpenAI(api_key="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")

# Test call
'''response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "system", "content": "You are a grammar corrector."},
        {"role": "user", "content": "This are wrong sentence."}
    ]
)

print(response.choices[0].message.content)
'''

@csrf_exempt
def grammar_correct(request):
    """API endpoint for complex grammar correction using ChatGPT"""
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body.decode("utf-8"))
        user_text = data.get("text", "").strip()

        if not user_text:
            return JsonResponse({"error": "No text provided"}, status=400)

        # Call ChatGPT API for grammar correction
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # or gpt-4.1 / gpt-3.5
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a professional grammar corrector. "
                        "Fix complex grammar, spelling, punctuation, and sentence structure. "
                        "Preserve the original meaning, but improve clarity and readability."
                    )
                },
                {"role": "user", "content": user_text}
            ],
            temperature=0.2  # Lower temperature for more precise corrections
        )

        corrected = response.choices[0].message.content.strip()

        return JsonResponse({"corrected": corrected})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
