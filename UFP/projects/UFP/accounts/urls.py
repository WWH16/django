from django.urls import path
from . import views
# REMOVE: from django.contrib.auth import views as auth_views
from .views import change_password_withEmail
from .api_views import ForgotPasswordView, ForgotPasswordView  

urlpatterns = [
    path('select/', views.select_view, name='select'), 
    path('login_student/', views.login_student_view, name='login_student'), 
    path('signup/', views.register_view, name='register'), 
    path('logout/', views.logout_view, name='logout'),
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),
    
    # REMOVE ALL THESE DJANGO BUILT-IN URLS (they're causing the internal server error):
    # path('password_reset/', auth_views.PasswordResetView.as_view(...)),
    # path('password_reset/done/', auth_views.PasswordResetDoneView.as_view(...)),
    # path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(...)),
    # path('reset/done/', auth_views.PasswordResetCompleteView.as_view(...)),

    # REPLACE WITH YOUR WORKING API:
    path('password_reset/', views.password_reset_form_view, name='password_reset'),  # Renders the form
    path('api/forgot-password/', ForgotPasswordView.as_view(), name='api_forgot_password'),  # Your working API
    path('api/reset-password/', ForgotPasswordView.as_view(), name='api_reset_password'),
    
    path('change_password_withEmail/', change_password_withEmail, name='change_password_withEmail'),
]