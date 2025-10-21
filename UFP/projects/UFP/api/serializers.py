from rest_framework import serializers
from warehouse.models import FactFeedback

class FactFeedbackSerializer(serializers.ModelSerializer):
    student = serializers.StringRelatedField()
    service = serializers.StringRelatedField()
    sentiment = serializers.StringRelatedField()
    class Meta:
        model = FactFeedback
        fields = ['feedback_id', 'student', 'service', 'sentiment', 'timestamp', 'comment_length', 'comments']