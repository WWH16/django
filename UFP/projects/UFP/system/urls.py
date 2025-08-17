from django.urls import path
from . import views

urlpatterns = [
    path('', views.site, name='site'),
    # Feedback/CRUD URLs moved to crud app
]

