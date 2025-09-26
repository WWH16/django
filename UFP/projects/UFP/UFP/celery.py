import os
from celery import Celery

# Set default Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "UFP.settings")

# Create Celery app
app = Celery("UFP")

# Load settings from Django settings (CELERY_ prefix)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks in all installed apps
app.autodiscover_tasks(lambda: os.environ.get("DJANGO_SETTINGS_MODULE"))

# Optional debug task
@app.task(bind=True)
def debug_task(self):
    print(f"Debug Task executed. Request: {self.request!r}")
