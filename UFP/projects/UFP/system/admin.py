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
from .models import (
    Service, Department, Sentiment, Program, Student,
    StudentFeedback, StudentActivityLog, Teacher, TeacherEvaluation
)
from warehouse.models import (
    DimService, DimSentiment, DimStudent, dim_teacher,
    fact_teacher_evaluation, FactFeedback
)

admin.site.unregister(User)
admin.site.unregister(Group)



# ------------------------------
# Regular models with Unfold
# ------------------------------

@admin.register(Service)
class ServiceAdmin(ModelAdmin):
    list_display = ('serviceID', 'serviceName')  # change fields according to your model
    search_fields = ('serviceName',)

@admin.register(Department)
class DepartmentAdmin(ModelAdmin):
    list_display = ('departmentID', 'departmentName')
    search_fields = ('departmentName',)

@admin.register(Sentiment)
class SentimentAdmin(ModelAdmin):
    list_display = ('sentimentID', 'sentimentName')
    search_fields = ('sentimentName',)

@admin.register(Program)
class ProgramAdmin(ModelAdmin):
    list_display = ('programID', 'programName')
    search_fields = ('programName',)
@admin.register(Student)
class StudentAdmin(ModelAdmin):
    list_display = ('studentID', 'studentName','program')
    search_fields = ('studentName',)
    list_filter = ('program',)

@admin.register(StudentFeedback)
class StudentFeedbackAdmin(ModelAdmin):
    list_display = ('student', 'comments', 'service', 'sentiment', 'timestamp')
    search_fields = ('student__studentName', 'service__serviceName')
    list_filter = ('service', 'sentiment', 'timestamp') 
class DepartmentFilter(admin.SimpleListFilter):
    title = 'department'  # filter title
    parameter_name = 'department'  # URL query param

    def lookups(self, request, model_admin):
        # Return a list of tuples: (value, label)
        departments = Department.objects.all()
        return [(d.departmentID, d.departmentName) for d in departments]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(department_id=self.value())
        return queryset
@admin.register(Teacher)
class TeacherAdmin(ModelAdmin, ImportExportModelAdmin):
    list_display = ('teacher_id', 'teacherName', 'department', 'program')
    search_fields = ('teacherName',)
    list_filter = (DepartmentFilter, 'program')
    ordering = ('teacherName',)
    show_filters = False  # some versions of Unfold require this
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm


@admin.register(TeacherEvaluation)
class TeacherEvaluationAdmin(ModelAdmin):
    list_display = ('teacher', 'timestamp', 'comments','specialization','program','submitted_by')
    search_fields = ('teacher__teacherName',)
    list_filter = ('sentiment', 'timestamp','specialization','program') 

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

@admin.register(dim_teacher)
class DimTeacherAdmin(ModelAdmin):
    list_display = ('teacher_id', 'teacher_name', 'program_name', 'department_name')
    search_fields = ('teacher_name',)
    list_filter = ('program_name', 'department_name')

@admin.register(fact_teacher_evaluation)
class FactTeacherEvaluationAdmin(ModelAdmin):
    list_display = ('teacher', 'comments', 'sentiment', 'timestamp')
    search_fields = ('teacher__teacher_name',)
    list_filter = ('sentiment', 'timestamp') 

@admin.register(FactFeedback)
class FactFeedbackAdmin(ModelAdmin):
    list_display = ('student', 'service','comments', 'sentiment', 'timestamp')
    search_fields = ('student__student_name', 'service__service_name')
    list_filter = ('service', 'sentiment', 'timestamp')


# ------------------------------
# for the admin
# ------------------------------
User = get_user_model()

@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    # Forms loaded from `unfold.forms`
    form = UserChangeForm
    add_form = UserCreationForm
    change_password_form = AdminPasswordChangeForm

@admin.register(Group)
class GroupAdmin(BaseGroupAdmin, ModelAdmin):
    pass

#@admin.register(User)
class UserAdmin(SimpleHistoryAdmin, ModelAdmin):
    pass

#class ConstanceConfigAdmin(ConstanceAdmin):
#    pass



# ------------------------------
# Read-only log model
# ------------------------------

@admin.register(StudentActivityLog)
class StudentActivityLogAdmin(ModelAdmin):
    list_display = ('student', 'activity_type', 'timestamp')
    list_filter = ('activity_type', 'timestamp', 'student')
    search_fields = ('student__studentName',)
    readonly_fields = ('logID', 'timestamp')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False  # prevent adding

    def has_change_permission(self, request, obj=None):
        return False  # prevent editing
    