from import_export import resources, fields
from .models import StudentFeedback, Student
from warehouse.models import  FactFeedback

class StudentResource(resources.ModelResource):
    class Meta:
        model = Student
        import_id_fields = ('studentID',)
        fields = ('studentID', 'studentName', 'program', 'yearLevel')

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