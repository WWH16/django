from django.urls import path
from . import views
from django.contrib.auth import views as auth_views
from .views import change_password_withEmail, ForgotPasswordView, ResetPasswordView

urlpatterns = [
    path('select/', views.select_view, name='select'), 
    path('login_student/', views.login_student_view, name='login_student'), 
    path('signup/', views.register_view, name='register'), 
    path('logout/', views.logout_view, name='logout'),
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),
    # path('password_reset/', auth_views.PasswordResetView.as_view(
    #     template_name='accounts/email/password_reset_form.html'
    # ), name='password_reset'),
    # path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(
    #     template_name='accounts/email/password_reset_done.html'
    # ), name='password_reset_done'),
    # path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
    #     template_name='accounts/email/password_reset_confirm.html'
    # ), name='password_reset_confirm'),
    # path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
    #     template_name='accounts/email/password_reset_complete.html'
    # ), name='password_reset_complete'),

        # REPLACE WITH - your custom implementation
    path('password_reset/', views.password_reset_form_view, name='password_reset'),  # Renders form
    path('api/forgot-password/', ForgotPasswordView.as_view(), name='api_forgot_password'),  # Processes form
    path('api/reset-password/', ResetPasswordView.as_view(), name='api_reset_password'),

    path('change_password_withEmail/', change_password_withEmail, name='change_password_withEmail'),
]
