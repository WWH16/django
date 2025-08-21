"""
URL configuration for UFP project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from dashboard.views import admin_osas_services
from dashboard.views import admin_teachers_evaluation

urlpatterns = [
    # Custom admin pages (must be before default admin route)
    path('admin/osas-services/', admin_osas_services, name='admin_osas_services'),
    path("admin/teachers-evaluation/", admin_teachers_evaluation, name="admin_teachers_evaluation"),



    path('admin/', admin.site.urls),
    path('', include('system.urls')),
    path('dashboard/', include('dashboard.urls')),
    path('accounts/', include('accounts.urls')),
    path('crud/', include('crud.urls')),
    path('api/', include('api.urls')),
    path('api-auth/', include('rest_framework.urls')),
]   