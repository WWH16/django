from rest_framework import serializers
from system.models import StudentFeedback

class StudentFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentFeedback
        fields = ['feedbackID', 'student', 'service', 'sentiment', 'comments', 'timestamp']

