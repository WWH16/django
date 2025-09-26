@echo off
REM ===========================================
REM Run Celery Worker and Celery Beat (Redis must already be running)
REM ===========================================

REM === Start Celery Worker in new window ===
start "Celery Worker" cmd /k "call C:\UFP\venv312\Scripts\Activate && cd C:\UFP && celery -A UFP worker -l info --pool=solo"

REM === Start Celery Beat in new window ===
start "Celery Beat" cmd /k "call C:\UFP\venv312\Scripts\Activate && cd C:\UFP && celery -A UFP beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler --max-interval 10"

REM === Notes for production on Ubuntu/Linux ===
REM On Ubuntu, use:
REM   redis-server --daemonize yes
REM   celery -A UFP worker -l info
REM   celery -A UFP beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler --detach
