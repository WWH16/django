from import_export import resources, fields
from .models import Teacher, TeacherEvaluation, StudentFeedback, Student
from warehouse.models import fact_teacher_evaluation, FactFeedback, DimService, DimSentiment, DimStudent, dim_teacher

class StudentResource(resources.ModelResource):
    class Meta:
        model = Student
        import_id_fields = ('studentID',)
        fields = ('studentID', 'studentName', 'program', 'yearLevel')

class TeacherResource(resources.ModelResource):
    class Meta:
        model = Teacher
        import_id_fields = ('teacher_id',)  
        fields = ('teacher_id', 'teacherName', 'department', 'program')

class TeacherEvaluationResource(resources.ModelResource):
    class Meta:
        model = TeacherEvaluation
        import_id_fields = ('evaluationid',)
        fields = (
            'evaluationid', 'teacher', 'timestamp', 'comments', 'specialization',
            'program', 'department', 'is_anonymous', 'submitted_by', 'sentiment'
        )

class StudentFeedbackResource(resources.ModelResource):
    class Meta:
        model = StudentFeedback
        import_id_fields = ('feedbackID',)
        fields = (
            'feedbackID', 'student', 'service', 'sentiment', 'comments', 'timestamp'
        )

# Warehouse resources
class FactFeedbackResource(resources.ModelResource):
    service = fields.Field(
        column_name='service',
        attribute='service__service_name' 
    )
    sentiment = fields.Field(
        column_name='sentiment',
        attribute='sentiment__label'  
    )
    
    class Meta:
        model = FactFeedback
        import_id_fields = ('feedback_id',)
        fields = ('service', 'sentiment', 'comments', 'timestamp')

class DimServiceResource(resources.ModelResource):
    class Meta:
        model = DimService
        import_id_fields = ('service_id',)
        fields = ('service_id', 'service_name')

class DimSentimentResource(resources.ModelResource):
    class Meta:
        model = DimSentiment
        import_id_fields = ('sentiment_id',)
        fields = ('sentiment_id', 'label')

class DimTeacherResource(resources.ModelResource):
    class Meta:
        model = dim_teacher
        import_id_fields = ('teacher_id',)
        fields = ('teacher_id', 'teacher_name', 'department_name', 'program_name')
        # Removed exclude since you're using fields

class DimStudentResource(resources.ModelResource):
    class Meta:
        model = DimStudent
        import_id_fields = ('student_id',)
        fields = ('student_id', 'student_name', 'program_name', 'department_name')  # Changed to match actual fields