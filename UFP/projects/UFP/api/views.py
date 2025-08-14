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
    evaluations = fact_teacher_evaluation.objects.select_related('teacher', 'sentiment').order_by('-timestamp')[:5]
    data = [
        {
            "teacher": e.teacher.teacher_name if e.teacher else "Unknown",
            "sentiment": e.sentiment.label if e.sentiment else "Unknown",
            "comments": e.comments,
            "timestamp": e.timestamp,
        }
        for e in evaluations
    ]
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

@api_view(['GET'])
def osas_sentiment_dashboard(request):
    qs = FactFeedback.objects.all()
    total = qs.count()
    positive = qs.filter(sentiment__label='Positive').count()
    neutral = qs.filter(sentiment__label='Neutral').count()
    negative = qs.filter(sentiment__label='Negative').count()
    # Per service
    services = []
    for service in qs.values_list('service__service_name', flat=True).distinct():
        s_qs = qs.filter(service__service_name=service)
        s_pos = s_qs.filter(sentiment__label='Positive').count()
        s_neu = s_qs.filter(sentiment__label='Neutral').count()
        s_neg = s_qs.filter(sentiment__label='Negative').count()
        s_total = s_qs.count()
        satisfaction = round((s_pos / s_total) * 100) if s_total else 0
        percent_negative = round((s_neg / s_total) * 100) if s_total else 0
        services.append({
            "name": service,
            "positive": s_pos,
            "neutral": s_neu,
            "negative": s_neg,
            "satisfaction": satisfaction,
            "percent_negative": percent_negative
        })
    return Response({
        "total": total,
        "positive": positive,
        "neutral": neutral,
        "negative": negative,
        "positive_percent": round(positive/total*100) if total else 0,
        "neutral_percent": round(neutral/total*100) if total else 0,
        "negative_percent": round(negative/total*100) if total else 0,
        "services": services
    })

    
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