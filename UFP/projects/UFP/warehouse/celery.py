import os
from celery import Celery

# Set default Django settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "warehouse.settings")

# Create Celery app
app = Celery("warehouse")

# Load Celery settings from Django settings (with CELERY_ prefix)
app.config_from_object("django.conf:settings", namespace="CELERY")

# Auto-discover tasks from all installed apps
app.autodiscover_tasks()

# Optional: Debug task for testing purposes
@app.task(bind=True)
def debug_task(self):
    print(f"Debug Task executed. Request: {self.request!r}")
