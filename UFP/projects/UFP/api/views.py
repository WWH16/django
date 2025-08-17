from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from system.models import StudentFeedback
from .serializers import FactFeedbackSerializer, TeacherEvaluationSerializer
from warehouse.models import FactFeedback, fact_teacher_evaluation, dim_teacher
from rest_framework.pagination import PageNumberPagination

# Create your views here.
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

@api_view(['GET'])
def teacher_evaluation_list(request):
    paginator = PageNumberPagination()
    paginator.page_size = int(request.GET.get('page_size', 10))
    evaluations = fact_teacher_evaluation.objects.select_related('teacher', 'student', 'sentiment').all()
    result_page = paginator.paginate_queryset(evaluations, request)
    serializer = TeacherEvaluationSerializer(result_page, many=True)
    return paginator.get_paginated_response(serializer.data)

@api_view(['GET'])
def teacher_evaluation_dashboard_stats(request):
    qs = fact_teacher_evaluation.objects.all()
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
    Get the 5 most recent teacher evaluations with teacher name, program, sentiment, and comments
    """
    limit = int(request.GET.get('limit', 5))  # Default to 5, allow customization
    
    evaluations = (
        fact_teacher_evaluation.objects
        .select_related('teacher', 'sentiment')
        .order_by('-timestamp')[:max(1, min(limit, 20))]  # Limit between 1-20
    )
    
    data = []
    for e in evaluations:
        # Get teacher name and program safely
        teacher_name = "Unknown Teacher"
        program_name = None
        
        if e.teacher:
            teacher_name = e.teacher.teacher_name or f"Teacher ID: {e.teacher.teacher_id}"
            program_name = getattr(e.teacher, 'program_name', None)
        
        # Get sentiment safely
        sentiment_label = "Unknown"
        if e.sentiment:
            sentiment_label = e.sentiment.label or "Unknown"
        
        # Clean comments
        comments = e.comments or "No comments provided"
        if len(comments) > 150:  # Truncate long comments
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
    from warehouse.models import fact_teacher_evaluation
    programs = [
        {"name": "BSIT"},
        {"name": "BSCS"},
        {"name": "BSEMC"},
    ]
    for prog in programs:
        qs = fact_teacher_evaluation.objects.filter(teacher__program_name=prog["name"])
        prog["positive"] = qs.filter(sentiment__label="Positive").count()
        prog["neutral"] = qs.filter(sentiment__label="Neutral").count()
        prog["negative"] = qs.filter(sentiment__label="Negative").count()
    return Response({"programs": programs})

@api_view(['GET'])
def teacher_improvement_priority(request):
    teachers = dim_teacher.objects.all()
    priority_list = []
    for teacher in teachers:
        evaluations = fact_teacher_evaluation.objects.filter(teacher=teacher)
        total = evaluations.count()
        if total == 0:
            continue
        negative = evaluations.filter(sentiment__label='Negative').count()
        percent_negative = round((negative / total) * 100)
        # Assign priority
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
    # Sort by percent_negative descending
    priority_list.sort(key=lambda x: x['percent_negative'], reverse=True)
    return Response(priority_list)


# sa filtering sa charts ng OSAS Sentiment Dashboard 

from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from rest_framework.decorators import api_view
from rest_framework.response import Response

from warehouse.models import FactFeedback 

@api_view(["GET"])
def osas_sentiment_dashboard(request):
    """
    GET /api/osas-sentiment-dashboard/
      - ?range=all|7d|30d|this_month|6m|1y
      - and/or ?start=YYYY-MM-DD&end=YYYY-MM-DD  (inclusive)
    Returns:
      { range, start, end, total, positive, neutral, negative,
        positive_percent, neutral_percent, negative_percent,
        services: [{name, positive, neutral, negative, satisfaction, percent_negative}] }
    """
    # ---- parse dates (inclusive) ----
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
        if key == "7d":
            start, end = today - timedelta(days=6), today
        elif key == "30d":
            start, end = today - timedelta(days=29), today
        elif key == "this_month":
            start, end = today.replace(day=1), today
        elif key == "6m":
            start, end = today - timedelta(days=182), today
        elif key == "1y":
            start, end = today - timedelta(days=365), today
        else:
            start, end = None, None
    if start and not end: end = today
    if end and not start: start = today

    # ---- base queryset ----
    qs = FactFeedback.objects.select_related("service", "sentiment")

    # Robust date filtering (works for DateField or DateTimeField, all DBs)
    if start and end:
        qs = qs.annotate(d=TruncDate("timestamp")).filter(d__gte=start, d__lte=end)

    # ---- topline totals ----
    total = qs.count()
    positive = qs.filter(sentiment__label='Positive').count()
    neutral  = qs.filter(sentiment__label='Neutral').count()
    negative = qs.filter(sentiment__label='Negative').count()

    pct = (lambda n, d: round((n/d)*100) if d else 0)

    # ---- per-service breakdown (efficient single query via annotation) ----
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

# sa recent feedbacks ng OSAS Sentiment Dashboard

@api_view(['GET'])
def recent_osas_feedback(request):
    """
    GET /api/recent-osas-feedback/?limit=3
    Returns latest OSAS feedback items: service, sentiment, comments.
    """
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
                    if v is None:
                        break
                if v:
                    return str(v)
            except Exception:
                pass
        return None

    data = []
    for f in qs:
        service_name = (
            pick(f, 'service__service_name', 'service__name', 'service__serviceName') or
            pick(f, 'category', 'category_name', 'service') or
            'Unknown'
        )
        sentiment_label = (
            pick(f, 'sentiment__label', 'sentiment__name', 'sentiment__value') or
            'Unknown'
        )
        comments = (
            pick(f, 'comments', 'comment', 'feedback', 'feedback_text',
                    'text', 'content', 'message', 'remarks') or ''
        )
        data.append({
            "service": service_name,
            "sentiment": sentiment_label,
            "comments": comments,
        })
    return Response(data)

# sa pag export ng teacher evaluation as csv per teacher
from django.db.models import Count, Q, F, Subquery, OuterRef
from warehouse.models import fact_teacher_evaluation as Eval
from system.models import Teacher
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.http import JsonResponse

def teacher_performance_by_teacher(request):
    # Read query params
    year = request.GET.get("year")
    semester = request.GET.get("semester")

    evals = Eval.objects.all()

    # Filter by year and semester using the timestamp field
    if year:
        try:
            year = int(year)
            evals = evals.filter(timestamp__year=year)
        except ValueError:
            pass  # invalid year, skip filter

    if semester:
        semester = str(semester)
        if semester == "1":
            # 1st Sem: Jan 1 – Jun 30
            evals = evals.filter(timestamp__month__gte=1, timestamp__month__lte=6)
        elif semester == "2":
            # 2nd Sem: Jul 1 – Dec 31
            evals = evals.filter(timestamp__month__gte=7, timestamp__month__lte=12)

    # Get teacher name from FK
    name_sq = Subquery(
        Teacher.objects
        .filter(teacher_id=OuterRef("teacher_id"))
        .values("teacherName")[:1]
    )

    qs = (
        evals
        .values("teacher_id")
        .annotate(
            teacher_name=name_sq,
            positive=Count("evaluation_id", filter=Q(sentiment_id=1)),
            negative=Count("evaluation_id", filter=Q(sentiment_id=2)),
            neutral=Count("evaluation_id", filter=Q(sentiment_id=3)),
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

# Fixed backend - group by program instead of teacher
from django.db.models import Count, Q, OuterRef, Subquery, F
from django.db.models.functions import ExtractYear
from rest_framework.decorators import api_view
from rest_framework.response import Response
from warehouse.models import fact_teacher_evaluation as Eval
from system.models import Teacher

# Replace your existing teacher_evaluation_by_semester function with this fixed version:

@api_view(['GET'])
def teacher_evaluation_by_semester(request):
    year = request.GET.get("year")
    program = request.GET.get("program")  # Optional
    semester = request.GET.get("semester")  # New parameter: '1' or '2'

    if not year:
        return Response({"error": "Missing required parameter: year"}, status=400)

    try:
        year = int(year)
    except ValueError:
        return Response({"error": "Invalid year format"}, status=400)

    # Base queryset filtered by year
    evaluations = (
        Eval.objects
        .annotate(evaluation_year=ExtractYear("timestamp"))
        .filter(evaluation_year=year)
        .select_related("teacher")
    )

    # Apply semester filter if provided
    if semester:
        if semester == '1':  # 1st semester (August-December)
            evaluations = evaluations.filter(
                Q(timestamp__month__gte=8) | 
                Q(timestamp__month__lte=12)
            )
        elif semester == '2':  # 2nd semester (January-May)
            evaluations = evaluations.filter(
                Q(timestamp__month__gte=1) & 
                Q(timestamp__month__lte=5)
            )

    # If program is provided, filter it
    if program:
        evaluations = evaluations.filter(teacher__program_name=program)

    # GROUP BY PROGRAM instead of teacher_id
    grouped = (
        evaluations
        .values('teacher__program_name')
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
        "semester": semester,  # Include semester in response
        "program": program,
        "programs": results
    })
