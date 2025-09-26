@echo off
REM ===========================================
REM Run Django, Celery Worker, and Celery Beat
REM ===========================================

REM Activate virtual environment
call venv312\Scripts\activate

REM Navigate to Django project folder
cd UFP\projects\UFP

REM Start Django development server in new window
start "Django Server" cmd /k "python manage.py runserver"

REM Start Celery Worker in new window
start "Celery Worker" cmd /k "python -m celery -A UFP.celery worker -l info --pool=solo"

REM Start Celery Beat in new window
start "Celery Beat" cmd /k "python -m celery -A UFP.celery beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler --max-interval 10"

echo All services launched!
pause
