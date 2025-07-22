from django.urls import path
from . import views

urlpatterns = [
    path('', views.give_feedback, name='give_feedback'),  # Shows the feedback form
    path('my-feedback/', views.my_feedback, name='my_feedback'),  # Shows the feedback dashboard/table
    path('profile/', views.profile, name='profile'),
    path('edit_profile/', views.edit_profile, name='edit_profile'),
]