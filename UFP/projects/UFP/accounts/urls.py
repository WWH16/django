from django.urls import path, include # Add include
from . import views
from .views import change_password_withEmail


urlpatterns = [
    path('select/', views.select_view, name='select'),
    path('login_student/', views.login_student_view, name='login_student'),
    path('signup/', views.register_view, name='register'),
    path('logout/', views.logout_view, name='logout'),
    path('get-programs/<int:department_id>/', views.get_programs_by_department, name='get_programs_by_department'),

    # NEW: Include the URLs from the django-rest-passwordreset library
    # The 'password_reset' namespace is crucial for the signal handler to find the URL
    path('api/password_reset/', include('django_rest_passwordreset.urls', namespace='password_reset')),

    # This is for a logged-in user to change their password, which is different
    path('change_password_withEmail/', change_password_withEmail, name='change_password_withEmail'),

    # This renders the frontend form for the user to enter their email.
    # It will then call the 'api/password_reset/reset_password' endpoint via AJAX.
    path('password_reset_form/', views.password_reset_form_view, name='password_reset_form_view'),
]