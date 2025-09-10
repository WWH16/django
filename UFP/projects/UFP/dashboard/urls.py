from django.urls import path, reverse_lazy
from django.contrib.auth import views as auth_views
from . import views


urlpatterns = [
    path('', views.give_feedback, name='give_feedback'),
    path('my-feedback/', views.my_feedback, name='my_feedback'),
    path('profile/', views.profile, name='profile'),
    path('profile/edit/', views.edit_student_profile, name='edit_profile'),  # for students
    path('teacher-evaluation/', views.teacher_evaluation, name='teacher_evaluation'),


# for admins
    path('admin/', views.admin_dashboard, name='admin_dashboard'),
    path('osas-services/', views.osas_services, name='osas_services'),
    path('teacher-evaluation-dashboard/', views.teacher_evaluation_dashboard, name='teacher_evaluation_dashboard'),
    path('reports/', views.admin_reports, name='admin_reports'),
    path('admin/activity-log/', views.admin_activity_log, name='admin_activity_log'),


    # account management
    path('admin/profile/', views.admin_profile, name='admin_profile'),
    path('admin/profile/edit/', views.edit_admin_profile, name='edit_admin_profile'),  
    path('change-password/', views.change_password, name='change_password'),
]