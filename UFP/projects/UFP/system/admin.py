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
from .resources import (TeacherResource, TeacherEvaluationResource, StudentFeedbackResource,
                        FactFeedbackResource,FactTeacherEvaluationResource, DimTeacherResource,
                        DimServiceResource, DimSentimentResource, DimStudentResource, StudentResource)

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
class StudentAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = StudentResource
    list_display = ('studentID', 'studentName','program')
    search_fields = ('studentName',)
    list_filter = ('program',)
    actions = ['export']
    import_form_class = ImportForm
    

@admin.register(StudentFeedback)
class StudentFeedbackAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = StudentFeedbackResource
    list_display = ('student', 'comments', 'service', 'timestamp', 'guest_id')
    search_fields = ('student__studentName', 'service__serviceName')
    list_filter = ('service', 'sentiment', 'timestamp') 
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
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
    resource_class = TeacherResource 
    list_display = ('teacher_id', 'teacherName', 'department', 'program')
    search_fields = ('teacherName',)
    list_filter = (DepartmentFilter, 'program')
    ordering = ('teacherName',)
    show_filters = False  # some versions of Unfold require this
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm


@admin.register(TeacherEvaluation)
class TeacherEvaluationAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = TeacherEvaluationResource
    list_display = ('teacher', 'timestamp', 'comments','program','submitted_by')
    search_fields = ('teacher__teacherName',)
    list_filter = ('sentiment', 'timestamp','program') 
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm

# ------------------------------
# Warehouse models
# ------------------------------
@admin.register(FactFeedback)
class FactFeedbackAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = FactFeedbackResource
    list_display = ('student', 'service','comments', 'sentiment', 'timestamp')
    search_fields = ('student__student_name', 'service__service_name')
    list_filter = ('service', 'sentiment', 'timestamp')
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm

@admin.register(fact_teacher_evaluation)
class FactTeacherEvaluationAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = FactTeacherEvaluationResource
    list_display = ('teacher', 'comments', 'sentiment', 'timestamp')
    search_fields = ('teacher__teacher_name',)
    list_filter = ('sentiment', 'timestamp') 
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm

@admin.register(DimService)
class DimServiceAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = DimServiceResource
    list_display = ('service_id', 'service_name')
    search_fields = ('service_name',)
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
@admin.register(DimSentiment)
class DimSentimentAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = DimSentimentResource
    list_display = ('sentiment_id', 'label')
    search_fields = ('label',)
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
@admin.register(DimStudent)
class DimStudentAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = DimStudentResource
    list_display = ('student_id', 'student_name', 'program_id', 'program_name')
    search_fields = ('student_name', 'student_id')
    list_filter = ('program_name',)
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
@admin.register(dim_teacher)
class DimTeacherAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = DimTeacherResource
    list_display = ('teacher_id', 'teacher_name', 'department_name', 'program_name')
    search_fields = ('teacher_name', 'teacher_id')
    list_filter = ('department_name', 'program_name')
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
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
    list_filter = ('activity_type', 'timestamp')
    search_fields = ('student__studentName',)
    readonly_fields = ('logID', 'timestamp')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False  # prevent adding

    def has_change_permission(self, request, obj=None):
        return False  # prevent editing
    
# cron job
# admin.py
from django.contrib import admin
from unfold.admin import ModelAdmin
from unfold.widgets import UnfoldAdminSelectWidget, UnfoldAdminTextInputWidget

from django_celery_beat.models import (
    ClockedSchedule,
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
    SolarSchedule,
)
from django_celery_beat.admin import ClockedScheduleAdmin as BaseClockedScheduleAdmin
from django_celery_beat.admin import CrontabScheduleAdmin as BaseCrontabScheduleAdmin
from django_celery_beat.admin import PeriodicTaskAdmin as BasePeriodicTaskAdmin
from django_celery_beat.admin import PeriodicTaskForm, TaskSelectWidget

admin.site.unregister(PeriodicTask)
admin.site.unregister(IntervalSchedule)
admin.site.unregister(CrontabSchedule)
admin.site.unregister(SolarSchedule)
admin.site.unregister(ClockedSchedule)


class UnfoldTaskSelectWidget(UnfoldAdminSelectWidget, TaskSelectWidget):
    pass


class UnfoldPeriodicTaskForm(PeriodicTaskForm):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["task"].widget = UnfoldAdminTextInputWidget()
        self.fields["regtask"].widget = UnfoldTaskSelectWidget()


@admin.register(PeriodicTask)
class PeriodicTaskAdmin(BasePeriodicTaskAdmin, ModelAdmin):
    form = UnfoldPeriodicTaskForm


@admin.register(IntervalSchedule)
class IntervalScheduleAdmin(ModelAdmin):
    pass


@admin.register(CrontabSchedule)
class CrontabScheduleAdmin(BaseCrontabScheduleAdmin, ModelAdmin):
    pass


@admin.register(SolarSchedule)
class SolarScheduleAdmin(ModelAdmin):
    pass

@admin.register(ClockedSchedule)
class ClockedScheduleAdmin(BaseClockedScheduleAdmin, ModelAdmin):
    pass