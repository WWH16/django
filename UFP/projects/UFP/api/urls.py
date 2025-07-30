from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .views import FeedbackViewSet

router = DefaultRouter()
router.register(r'feedback', FeedbackViewSet, basename='student-feedback')

urlpatterns = [
    path('', views.api_home, name='api-home'),
    # Remove the redundant 'api/' prefix since DefaultRouter already handles this
    path('', include(router.urls)),
]