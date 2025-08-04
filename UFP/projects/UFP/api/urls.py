from django.urls import path
from . import views

urlpatterns = [
    # Add your API URL patterns here
    path('feedback/', views.feedback_list, name='feedback_list'),
]   