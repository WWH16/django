from django.urls import path
from . import views
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('select/', views.select_view, name='select'),
    path('login_admin/', views.login_admin_view, name='login_admin'),   
    path('login_student/', views.login_student_view, name='login_student'), 
    path('signup/', views.register_view, name='register'), 
    path('logout/', views.logout_view, name='logout'),
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),
    path('password_reset/', auth_views.PasswordResetView.as_view(
        template_name='accounts/password_reset_form.html'
    ), name='password_reset'),
    path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='accounts/password_reset_done.html'
    ), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='accounts/password_reset_confirm.html'
    ), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='accounts/password_reset_complete.html'
    ), name='password_reset_complete'),
]