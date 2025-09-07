# accounts/urls.py
from django.urls import path, include
from . import views
from .views import change_password_withEmail

urlpatterns = [
    path('select/', views.select_view, name='select'),
    path('login_student/', views.login_student_view, name='login_student'),
    path('signup/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),

    # This is the correct inclusion of the password reset URLs
    path('api/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),

    path('change_password_withEmail/', change_password_withEmail, name='change_password_withEmail'),
    path('password_reset_form/', views.password_reset_form_view, name='password_reset_form_view'),
]