from import_export import resources, fields, widgets
from .models import StudentFeedback, Student, Service, Sentiment
from warehouse.models import FactFeedback, DimService, DimSentiment

class StudentResource(resources.ModelResource):
    class Meta:
        model = Student
        import_id_fields = ('studentID',)
        fields = ('studentID', 'studentName', 'program', 'yearLevel')

class StudentFeedbackResource(resources.ModelResource):
    student = fields.Field(
        column_name='student',
        attribute='student',
        widget=widgets.ForeignKeyWidget(Student, 'studentID')
    )
    service = fields.Field(
        column_name='service',
        attribute='service',
        widget=widgets.ForeignKeyWidget(Service, 'serviceID')
    )
    sentiment = fields.Field(
        column_name='sentiment',
        attribute='sentiment',
        widget=widgets.ForeignKeyWidget(Sentiment, 'sentimentID')
    )
    timestamp = fields.Field(
        column_name='timestamp',
        attribute='timestamp',
        widget=widgets.DateTimeWidget(format='%d/%m/%Y %H:%M')
    )
    
    class Meta:
        model = StudentFeedback
        import_id_fields = ('feedbackID',)
        fields = ('feedbackID', 'student', 'service', 'sentiment', 'comments', 'timestamp')
        skip_unchanged = True

# Warehouse resources
class FactFeedbackResource(resources.ModelResource):
    service = fields.Field(
        column_name='service',
        attribute='service',
        widget=widgets.ForeignKeyWidget(DimService, 'service_name')  # Changed to service_name
    )
    sentiment = fields.Field(
        column_name='sentiment',
        attribute='sentiment',
        widget=widgets.ForeignKeyWidget(DimSentiment, 'label')  # Changed to label (or whatever the name field is)
    )
    timestamp = fields.Field(
        column_name='timestamp',
        attribute='timestamp',
        widget=widgets.DateTimeWidget(format='%Y-%m-%d %H:%M:%S')  # Also fixed timestamp format
    )
    
    class Meta:
        model = FactFeedback
        import_id_fields = ('feedback_id',)
        fields = ('feedback_id', 'service', 'sentiment', 'comments', 'timestamp')
        skip_unchanged = True