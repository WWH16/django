@echo off
REM === Activate virtual environment ===
call venv312\Scripts\activate
cd UFP\projects\UFP
celery -A UFP worker -l info
REM === Django Development Server ===
python manage.py runserver