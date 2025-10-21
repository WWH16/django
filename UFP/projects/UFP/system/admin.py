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
from unfold.contrib.import_export.forms import ExportForm, ImportForm



from .models import (Service,  Sentiment, Student, StudentFeedback, StudentActivityLog)

from warehouse.models import (
    DimService, FactFeedback
)
from .resources import (
    StudentFeedbackResource,
    FactFeedbackResource,
    StudentResource
)



admin.site.unregister(User)
admin.site.unregister(Group)



# ------------------------------
# Regular models with Unfold
# ------------------------------
from django.contrib import admin
from datetime import date

#Semester Filter
class SemesterFilter(admin.SimpleListFilter):
    title = 'Semester'
    parameter_name = 'semester'

    def lookups(self, request, model_admin):
        return (
            ('1st', '1st Semester'),
            ('2nd', '2nd Semester'),
        )

    def queryset(self, request, queryset):
        
        current_year = date.today().year

        if self.value() == '1st':
            start = date(current_year, 9, 1)
            end = date(current_year, 12, 31)
            return queryset.filter(timestamp__gte=start, timestamp__lte=end)

        if self.value() == '2nd':
            start = date(current_year, 1, 1)
            end = date(current_year, 5, 31)
            return queryset.filter(timestamp__gte=start, timestamp__lte=end)

        return queryset

@admin.register(Service)
class ServiceAdmin(ModelAdmin):

    list_display = ('serviceID', 'serviceName')  # change fields according to your model
    search_fields = ('serviceName',)

@admin.register(Sentiment)
class SentimentAdmin(ModelAdmin):
    list_display = ('sentimentID', 'sentimentName')
    search_fields = ('sentimentName',)

@admin.register(Student)
class StudentAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = StudentResource
    list_display = ('studentID', 'studentName','program')
    search_fields = ('studentName',)
    list_filter = ('program',)
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm
    

@admin.register(StudentFeedback)
class StudentFeedbackAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = StudentFeedbackResource
    list_display = ('comments', 'service', 'timestamp')
    search_fields = ('student__studentName', 'service__serviceName')
    list_filter = ('service', 'sentiment', SemesterFilter) 
    actions = ['export']
    import_form_class = ImportForm
    export_form_class = ExportForm


from django.urls import reverse
from django.template.loader import render_to_string

from django.urls import reverse
from django.utils.html import format_html

@admin.register(FactFeedback)
class FactFeedbackAdmin(ModelAdmin, ImportExportModelAdmin):
    resource_class = FactFeedbackResource
    list_display = ('service', 'comments', 'sentiment', 'timestamp')
    list_filter = ('sentiment', SemesterFilter)
    import_form_class = ImportForm
    export_form_class = ExportForm

    change_list_template = "admin/warehouse/factfeedback/change_list.html"

    def changelist_view(self, request, extra_context=None):
        try:
            services = DimService.objects.all().order_by('service_name')
            active_service = request.GET.get('service')

            buttons = []
            all_url = reverse('admin:warehouse_factfeedback_changelist')
            is_all_active = not active_service

            def btn_class(active):
                base = "service-button"
                if active:
                    base += " active"
                return base

            # Build the buttons
            buttons.append(f'<a href="{all_url}" class="{btn_class(is_all_active)}">All</a>')
            for s in services:
                url = f"{reverse('admin:warehouse_factfeedback_changelist')}?service={s.service_id}"
                active = active_service == str(s.service_id)
                buttons.append(f'<a href="{url}" class="{btn_class(active)}">{s.service_name}</a>')

            # Pass buttons to template
            button_html = f'<div class="service-buttons-container">{" ".join(buttons)}</div>'
            extra_context = extra_context or {}
            extra_context["service_buttons"] = format_html(button_html)

            # Filter queryset
            response = super().changelist_view(request, extra_context=extra_context)
            if active_service and hasattr(response, "context_data"):
                queryset = response.context_data["cl"].queryset
                response.context_data["cl"].queryset = queryset.filter(service__service_id=active_service)
            return response

        except Exception as e:
            print("Error in changelist_view:", e)
            extra_context = extra_context or {}
            extra_context["service_buttons"] = ""
            return super().changelist_view(request, extra_context=extra_context)



#@admin.register(DimService)
#class DimServiceAdmin(ModelAdmin, ImportExportModelAdmin):
#    resource_class = DimServiceResource
#    list_display = ('service_id', 'service_name')
#   search_fields = ('service_name',)
#    actions = ['export']
#    import_form_class = ImportForm
#   export_form_class = ExportForm
#@admin.register(DimSentiment)
#class DimSentimentAdmin(ModelAdmin, ImportExportModelAdmin):
#    resource_class = DimSentimentResource
#    list_display = ('sentiment_id', 'label')
#    search_fields = ('label',)
#    actions = ['export']
#    import_form_class = ImportForm
#    export_form_class = ExportForm
#@admin.register(DimStudent)
#class DimStudentAdmin(ModelAdmin, ImportExportModelAdmin):
#    resource_class = DimStudentResource
#    list_display = ('student_id', 'student_name', 'program_id', 'program_name')
#    search_fields = ('student_name', 'student_id')
#    list_filter = ('program_name',)
#    actions = ['export']
#    import_form_class = ImportForm
#    export_form_class = ExportForm
#@admin.register(dim_teacher)
#class DimTeacherAdmin(ModelAdmin, ImportExportModelAdmin):
#    resource_class = DimTeacherResource
#    list_display = ('teacher_id', 'teacher_name', 'department_name', 'program_name')
#    search_fields = ('teacher_name', 'teacher_id')
#    list_filter = ('department_name', 'program_name')
#    actions = ['export']
#    import_form_class = ImportForm
#   export_form_class = ExportForm
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
    
# ------------------------------
# Celery tasks
# ------------------------------
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


from django_celery_results.models import TaskResult, GroupResult
from django_celery_results.admin import TaskResultAdmin as DefaultTaskResultAdmin
#from django_celery_results.admin import GroupResultAdmin as DefaultGroupResultAdmin

admin.site.unregister(TaskResult)

from django_celery_results.models import TaskResult

@admin.register(TaskResult)
class TaskResultAdmin(DefaultTaskResultAdmin, ModelAdmin):
    list_filter = ('status', 'date_done', 'task_name', 'result')

#admin.site.unregister(GroupResult)
#@admin.register(GroupResult)
#class GroupResultAdmin(DefaultGroupResultAdmin, ModelAdmin):
#    list_filter = ('group_id', 'result', 'date_done')