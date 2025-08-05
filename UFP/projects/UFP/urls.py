from django.urls import path, include

urlpatterns = [
    # ... other urls ...
    path('dashboard/', include('dashboard.urls')),
]