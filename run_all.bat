@echo off
REM ===========================================
REM Run Django, Celery Worker, and Celery Beat
REM ===========================================

REM Save root directory of this script (always with trailing \)
set ROOTDIR=%~dp0

REM Start Django development server in new window
start "Django Server" cmd /k "call "%ROOTDIR%venv312\Scripts\activate" && cd /d "%ROOTDIR%UFP\projects\UFP" && python manage.py runserver"

REM Start Celery Worker in new window
start "Celery Worker" cmd /k "call "%ROOTDIR%venv312\Scripts\activate" && cd /d "%ROOTDIR%UFP\projects\UFP" && python -m celery -A UFP.celery worker -l info --pool=solo"

REM Start Celery Beat in new window
start "Celery Beat" cmd /k "call "%ROOTDIR%venv312\Scripts\activate" && cd /d "%ROOTDIR%UFP\projects\UFP" && python -m celery -A UFP.celery beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler --max-interval 10"

echo All services launched!
exit /b
