from django.urls import path
from . import views

urlpatterns = [
    path('fact-feedback/', views.fact_feedback_list, name='api_fact_feedback_list'),
    path('teacher-evaluations/', views.teacher_evaluation_list, name='api_teacher_evaluation_list'),
    path('teacher-evaluation-dashboard/', views.teacher_evaluation_dashboard_stats, name='teacher_evaluation_dashboard_stats'),
    path('recent-teacher-evaluations/', views.recent_teacher_evaluations, name='recent_teacher_evaluations'),
    path('teacher-performance-by-program/', views.teacher_performance_by_program, name='teacher_performance_by_program'),
    path('teacher-improvement-priority/', views.teacher_improvement_priority, name='teacher_improvement_priority'),
    path('osas-sentiment-dashboard/', views.osas_sentiment_dashboard, name='osas_sentiment_dashboard'),
    path('teacher-performance-by-teacher/', views.teacher_performance_by_teacher, name='teacher-performance-by-teacher'),
]