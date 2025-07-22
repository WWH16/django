from django.contrib import messages
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.db.models import Count
import csv
import json
import os
from datetime import datetime
from django.utils.encoding import smart_str
from django.conf import settings
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.contrib.auth.decorators import login_required
from django.shortcuts import render

from .models import StudentFeedback, Student, Service, Sentiment
from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.contenttypes.models import ContentType
# Create your views here.
def form(request):
    return render(request, 'base.html')

def wifi_view(request):
    return render(request, 'Wifi.html')

def scholar_view(request):
    return render(request, 'scholar.html')

def library_view(request):
    return render(request, 'library.html')

def guidance_view(request):
    return render(request, 'guidance.html')
def help_view(request):
    return render(request, 'help.html')
def home_view(request):
    return render(request, 'home.html')
def main(request):
    return render(request, 'main.html')
def sample(request):
    return render(request, 'index.html')
def jancen(request):
    return render(request, 'jancen.html')
def admin_pan(request):
    return render(request, 'admin_panel.html')
# Feedback/CRUD-related views have been moved to crud/views.py


def error(request):
    return HttpResponse("Hello, world. You're at the polls index.")


