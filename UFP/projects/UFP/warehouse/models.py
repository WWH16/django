from django.db import models
import uuid
from datetime import datetime
from django.utils import timezone

class DimStudent(models.Model):
    student_id = models.CharField(max_length=50, primary_key=True)
    student_name = models.CharField(max_length=100, blank=True, null=True)
    program_id = models.IntegerField(blank=True, null=True)
    program_name = models.CharField(max_length=100, blank=True, null=True)  
    department_id = models.IntegerField(blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'warehouse"."dim_student'  # Required if schema is warehouse

    def __str__(self):
        return self.student_name or self.student_id


class DimService(models.Model):
    service_id = models.AutoField(primary_key=True)
    service_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'warehouse"."dim_service'

    def __str__(self):
        return self.service_name


class DimSentiment(models.Model):
    sentiment_id = models.AutoField(primary_key=True)
    label = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = 'warehouse"."dim_sentiment'

    def __str__(self):
        return self.label


class FactFeedback(models.Model):
    feedback_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(DimStudent, on_delete=models.SET_NULL, null=True, db_column='student_id')
    service = models.ForeignKey(DimService, on_delete=models.SET_NULL, null=True, db_column='service_id')
    sentiment = models.ForeignKey(DimSentiment, on_delete=models.SET_NULL, null=True, db_column='sentiment_id')
    timestamp = models.DateTimeField()
    comment_length = models.IntegerField(blank=True, null=True)
    comments = models.TextField(blank=True, null=True)

    class Meta:
        db_table = 'warehouse"."fact_feedback'

    def __str__(self):
        return str(self.feedback_id)

class dim_teacher(models.Model):
    teacher_id = models.CharField(max_length=50, primary_key=True)
    teacher_name = models.CharField(max_length=100, blank=True, null=True)
    department_id = models.IntegerField(blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)
    program_id = models.IntegerField(blank=True, null=True)
    program_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = 'warehouse"."dim_teacher'

    def __str__(self):
        return self.teacher_name or self.teacher_id
    
class fact_teacher_evaluation(models.Model):
    evaluation_id = models.AutoField(primary_key=True)
    teacher = models.ForeignKey(dim_teacher, on_delete=models.SET_NULL, null=True, db_column='teacher_id')
    student = models.ForeignKey(DimStudent, on_delete=models.SET_NULL, null=True, db_column='student_id')
    sentiment = models.ForeignKey(DimSentiment, on_delete=models.SET_NULL, null=True, db_column='sentiment_id')
    comment_length = models.IntegerField(blank=True, null=True)
    comments = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'warehouse"."fact_teacher_evaluation'

    def __str__(self):
        return str(self.evaluation_id) + " - " + (self.teacher.teacher_name if self.teacher else "Unknown Teacher")