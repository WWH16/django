from django.db import models
from django.utils import timezone


# ---------------------- Dimension Tables ----------------------

class DimStudent(models.Model):
    student_id = models.CharField(max_length=50, primary_key=True)
    student_name = models.CharField(max_length=100, blank=True, null=True)
    program_id = models.IntegerField(blank=True, null=True)
    program_name = models.CharField(max_length=100, blank=True, null=True)
    department_id = models.IntegerField(blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "warehouse_dim_student"

    def __str__(self):
        return self.student_name or self.student_id


class DimService(models.Model):
    service_id = models.AutoField(primary_key=True)
    service_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "warehouse_dim_service"

    def __str__(self):
        return self.service_name or str(self.service_id)


class DimSentiment(models.Model):
    sentiment_id = models.AutoField(primary_key=True)
    label = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = "warehouse_dim_sentiment"

    def __str__(self):
        return self.label or str(self.sentiment_id)


class DimTeacher(models.Model):
    teacher_id = models.CharField(max_length=50, primary_key=True)
    teacher_name = models.CharField(max_length=100, blank=True, null=True)
    department_id = models.IntegerField(blank=True, null=True)
    department_name = models.CharField(max_length=100, blank=True, null=True)
    program_id = models.IntegerField(blank=True, null=True)
    program_name = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "warehouse_dim_teacher"

    def __str__(self):
        return self.teacher_name or self.teacher_id


# ---------------------- Fact Tables ----------------------

class FactFeedback(models.Model):
    feedback_id = models.AutoField(primary_key=True)
    student = models.ForeignKey(
        DimStudent, on_delete=models.SET_NULL, null=True, db_column="student_id"
    )
    service = models.ForeignKey(
        DimService, on_delete=models.SET_NULL, null=True, db_column="service_id"
    )
    sentiment = models.ForeignKey(
        DimSentiment, on_delete=models.SET_NULL, null=True, db_column="sentiment_id"
    )
    comments = models.TextField(blank=True, null=True)
    comment_length = models.IntegerField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "warehouse_fact_feedback"

    def __str__(self):
        return f"Feedback {self.feedback_id}"


class FactTeacherEvaluation(models.Model):
    evaluation_id = models.AutoField(primary_key=True)
    teacher = models.ForeignKey(
        DimTeacher, on_delete=models.SET_NULL, null=True, db_column="teacher_id"
    )
    student = models.ForeignKey(
        DimStudent, on_delete=models.SET_NULL, null=True, db_column="student_id"
    )
    sentiment = models.ForeignKey(
        DimSentiment, on_delete=models.SET_NULL, null=True, db_column="sentiment_id"
    )
    comments = models.TextField(blank=True, null=True)
    comment_length = models.IntegerField(blank=True, null=True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "warehouse_fact_teacher_evaluation"

    def __str__(self):
        teacher_name = self.teacher.teacher_name if self.teacher else "Unknown Teacher"
        return f"Evaluation {self.evaluation_id} - {teacher_name}"
