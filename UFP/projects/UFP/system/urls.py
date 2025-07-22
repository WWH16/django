from django.urls import path
from . import views

urlpatterns = [
    path('', views.sample, name='sample'),
    # Feedback/CRUD URLs moved to crud app
]

