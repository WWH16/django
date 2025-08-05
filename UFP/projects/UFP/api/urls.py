from django.urls import path
from . import views

urlpatterns = [
    path('fact-feedback/', views.fact_feedback_list, name='api_fact_feedback_list'),
    path('teacher-evaluations/', views.teacher_evaluation_list, name='api_teacher_evaluation_list'),
]