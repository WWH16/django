from import_export import resources
from .models import Teacher, TeacherEvaluation, StudentFeedback
from warehouse.models import fact_teacher_evaluation, FactFeedback

class TeacherResource(resources.ModelResource):
    class Meta:
        model = Teacher
        import_id_fields = ('teacher_id',)  
        fields = ('teacher_id', 'teacherName', 'department', 'program')

class TeacherEvaluationResource(resources.ModelResource):
    class Meta:
        model = TeacherEvaluation
        import_id_fields = ('evaluationid',)  # primary key
        fields = (
            'evaluationid', 'teacher', 'timestamp', 'comments', 'specialization',
            'program', 'department', 'is_anonymous', 'submitted_by', 'sentiment'
        )

class StudentFeedbackResource(resources.ModelResource):
    class Meta:
        model = StudentFeedback
        import_id_fields = ('feedbackID',)  # primary key
        fields = (
            'feedbackID', 'student', 'service', 'sentiment', 'comments', 'timestamp'
        )

# warehouse resources
class FactFeedbackResource(resources.ModelResource):
    class Meta:
        model = FactFeedback
        import_id_fields = ('id',)  # primary key
        fields = (
            'feedback_id', 'student', 'service', 'sentiment', 'comment_length', 'comments', 'timestamp'
        )

class FactTeacherEvaluationResource(resources.ModelResource):
    class Meta:
        model = fact_teacher_evaluation
        import_id_fields = ('id',)  # primary key
        fields = (
            'evaluation_id', 'teacher', 'student', 'sentiment', 'comment_length', 'comments', 'timestamp'
        )