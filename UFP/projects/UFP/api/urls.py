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

    # sa recent sa osas dashboard
    path('recent-osas-feedback/', views.recent_osas_feedback, name='recent-osas-feedback'),
    path('teacher-performance-by-teacher/', views.teacher_performance_by_teacher, name='teacher-performance-by-teacher'),
    path('teacher-evaluation-by-semester/', views.teacher_evaluation_by_semester, name='teacher_evaluation_by_semester'),
    path('service-feedback-by-semester/', views.service_feedback_by_semester, name='service_feedback_by_semester'),

    path("grammar-correct/", views.grammar_correct, name="grammar_correct"),
]