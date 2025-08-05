from rest_framework import serializers
from warehouse.models import FactFeedback, fact_teacher_evaluation

class FactFeedbackSerializer(serializers.ModelSerializer):
    student = serializers.StringRelatedField()
    service = serializers.StringRelatedField()
    sentiment = serializers.StringRelatedField()
    class Meta:
        model = FactFeedback
        fields = ['feedback_id', 'student', 'service', 'sentiment', 'timestamp', 'comment_length', 'comments']

class TeacherEvaluationSerializer(serializers.ModelSerializer):
    teacher = serializers.StringRelatedField()
    student = serializers.StringRelatedField()
    sentiment = serializers.StringRelatedField()
    class Meta:
        model = fact_teacher_evaluation
        fields = ['evaluation_id', 'teacher', 'student', 'sentiment', 'timestamp', 'comment_length', 'comments']

