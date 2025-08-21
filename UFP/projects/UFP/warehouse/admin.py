from django.contrib import admin
from django.contrib.admin import AdminSite
from django.utils.html import format_html
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.admin import GroupAdmin as BaseGroupAdmin
from django.contrib.auth.models import User, Group

from unfold.forms import AdminPasswordChangeForm, UserChangeForm, UserCreationForm
from unfold.admin import ModelAdmin

from django.contrib.auth import get_user_model
from simple_history.admin import SimpleHistoryAdmin
from import_export.admin import ImportExportModelAdmin
from unfold.contrib.import_export.forms import ExportForm, ImportForm, SelectableFieldsExportForm


from django.contrib.admin import RelatedOnlyFieldListFilter
from warehouse.models import DimStudent, DimService, DimSentiment, FactFeedback, DimTeacher, FactTeacherEvaluation

# Register your models here.
# ------------------------------
# Warehouse models
# ------------------------------

@admin.register(DimService)
class DimServiceAdmin(ModelAdmin):
    list_display = ('service_id', 'service_name')
    search_fields = ('service_name',)

@admin.register(DimSentiment)
class DimSentimentAdmin(ModelAdmin):
    list_display = ('sentiment_id', 'label')
    search_fields = ('label',)

@admin.register(DimStudent)
class DimStudentAdmin(ModelAdmin):
    list_display = ('student_id', 'student_name', 'program_name', 'department_name')
    search_fields = ('student_name','program_name','department_name')
    list_filter = ('program_name', 'department_name')

@admin.register(DimTeacher)
class DimTeacherAdmin(ModelAdmin):
    list_display = ('teacher_id', 'teacher_name', 'program_name', 'department_name')
    search_fields = ('teacher_name',)
    list_filter = ('program_name', 'department_name')

@admin.register(FactTeacherEvaluation)
class FactTeacherEvaluationAdmin(ModelAdmin):
    list_display = ('teacher', 'timestamp', 'comments')
    search_fields = ('teacher__teacher_name',)
    list_filter = ('sentiment', 'timestamp') 

@admin.register(FactFeedback)
class FactFeedbackAdmin(ModelAdmin):
    list_display = ('student', 'service', 'sentiment', 'timestamp')
    search_fields = ('student__student_name', 'service__service_name')
    list_filter = ('service', 'sentiment', 'timestamp')