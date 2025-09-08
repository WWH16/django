from django.urls import path, include
from django.views.generic import TemplateView
from . import views
from .views import password_reset_form_view, reset_password_confirm_view, change_password_withEmail

urlpatterns = [
    path('login_student/', views.login_student_view, name='login_student'),
    path('signup/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('select/', views.select_view, name='select'),

    # Password reset API
    path('api/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),

    # Custom pages
    path('password_reset_form/', password_reset_form_view, name='password_reset_form_view'),
    path(
        'password_reset_sent/',
        TemplateView.as_view(template_name='accounts/email/password_reset_done.html'),
        name='password_reset_sent'
    ),
    path('reset_password_confirm/', reset_password_confirm_view, name='reset_password_confirm_view'),
    path('change_password_withEmail/', change_password_withEmail, name='change_password_withEmail'),

    # Add the missing route for get-programs
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),
]