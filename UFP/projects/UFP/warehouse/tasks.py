from celery import shared_task
import datetime

@shared_task
def print_hello():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"Hello from Celery at {now}")
    return f"Executed at {now}"
