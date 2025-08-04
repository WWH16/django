from django.contrib import admin
from .models import Service, Department, Sentiment, Program, Student, StudentFeedback, StudentActivityLog, Teacher, TeacherEvaluation   
# Register your models here.
admin.site.register(Service)
admin.site.register(Department)
admin.site.register(Sentiment)
admin.site.register(Program)
admin.site.register(Student)
admin.site.register(StudentFeedback)
admin.site.register(Teacher)
admin.site.register(TeacherEvaluation)

@admin.register(StudentActivityLog)
class StudentActivityLogAdmin(admin.ModelAdmin):
    list_display = ('student', 'activity_type', 'timestamp')
    list_filter = ('activity_type', 'timestamp', 'student')
    search_fields = ('student__studentName',)
    readonly_fields = ('logID', 'timestamp')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)
    
    def has_add_permission(self, request):
        # Prevent manual creation of log entries
        return False
    
    def has_change_permission(self, request, obj=None):
        # Prevent editing of log entries
        return False
