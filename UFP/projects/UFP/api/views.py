from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import viewsets
from .serializers import StudentFeedbackSerializer
from system.models import StudentFeedback

@api_view(['GET'])
def api_home(request):
    """
    API home endpoint to provide API information.
    """
    return Response({
        "status": "success",
        "version": "1.0.0",
        "endpoints": {
            "feedback": "/api/feedback/",
        }
    })

class FeedbackViewSet(viewsets.ModelViewSet):
    queryset = StudentFeedback.objects.all()
    serializer_class = StudentFeedbackSerializer