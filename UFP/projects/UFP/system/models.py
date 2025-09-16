from django.db import models
from datetime import datetime
from django.utils import timezone
# Create your models here.

class Service(models.Model):
    serviceID = models.AutoField(primary_key=True)
    serviceName = models.CharField(max_length=100)

    def __str__(self):
        return self.serviceName

class Department(models.Model):
    departmentID = models.AutoField(primary_key=True)
    departmentName = models.CharField(max_length=100)

    def __str__(self):
        return self.departmentName

class Sentiment(models.Model):
    sentimentID = models.AutoField(primary_key=True)
    sentimentName = models.CharField(max_length=100)

    def __str__(self):
        return self.sentimentName

class Program(models.Model):
    programID = models.AutoField(primary_key=True)
    programName = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)

    def __str__(self):
        return self.programName

class Student(models.Model):
    studentID = models.CharField(max_length=10, primary_key=True)
    studentName = models.CharField(max_length=100)
    password = models.CharField(max_length=128, null=True, blank=True)  # For storing hashed passwords
    program = models.ForeignKey(Program, on_delete=models.CASCADE, null=True)
    email = models.EmailField(unique=True, null=True)

    def __str__(self):
        return self.studentName

class StudentFeedback(models.Model):
    feedbackID = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, to_field='studentID', null=True, blank=True)
    guest_id = models.CharField(max_length=50, null=True, blank=True)
    service = models.ForeignKey(Service, on_delete=models.CASCADE)
    sentiment = models.ForeignKey(Sentiment, on_delete=models.CASCADE, null=True, blank=True)
    comments = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        sentiment_name = self.sentiment.sentimentName if self.sentiment else 'No Sentiment'
        return f"{self.student.studentName} - {self.service.serviceName} - {sentiment_name}"

class StudentActivityLog(models.Model):
    ACTIVITY_CHOICES = [
        ('StudentLoggedIn', 'Student logged in'),
        ('StudentLoggedOut', 'Student logged out'),
        ('StudentProvidedFeedback', 'Student provided feedback'),
        ('ProfileUpdated', 'Profile updated'),
        ('PasswordChanged', 'Password changed'),
	    ('AccountCreated', 'Account created'),
    ]

    logID = models.AutoField(primary_key=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, to_field='studentID')
    activity_type = models.CharField(max_length=40, choices=ACTIVITY_CHOICES)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']
        verbose_name = 'Student Activity Log'
        verbose_name_plural = 'Student Activity Logs'

    def __str__(self):
        return f"Student {self.student} {str(self.activity_type).lower()} at {self.timestamp}"

    
class Teacher(models.Model):
    teacher_id = models.CharField(max_length=50, primary_key=True)
    teacherName = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE)
    def __str__(self):
        return self.teacherName
    
from django.conf import settings

class TeacherEvaluation(models.Model):
    evaluationid = models.AutoField(primary_key=True)
    comments = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    program = models.ForeignKey(Program, on_delete=models.CASCADE, null=True, blank=True)
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    is_anonymous = models.BooleanField(default=False)
    submitted_by = models.CharField(max_length=100, null=True, blank=True)
    specialization = models.CharField(max_length=100, null=True, blank=True)
    sentiment = models.ForeignKey(Sentiment, on_delete=models.SET_NULL, null=True, blank=True)
    

    
    def __str__(self):
        return f"{self.teacher.teacherName} ({self.program.programName})"

