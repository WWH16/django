from __future__ import absolute_import, unicode_literals
import os
from celery import Celery

# set Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'UFP.settings')

app = Celery('UFP')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Optional debug task
@app.task(bind=True)
def debug_task(self):
    print(f"Debug Task executed. Request: {self.request!r}")
