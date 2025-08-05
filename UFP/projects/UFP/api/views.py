from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from system.models import StudentFeedback
from .serializers import FactFeedbackSerializer, TeacherEvaluationSerializer
from warehouse.models import FactFeedback, fact_teacher_evaluation
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