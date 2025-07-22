from django.urls import path
from . import views

urlpatterns = [
    path('', views.student_feedback_view, name='student_feedback_view'),
    path('delete/<int:feedback_id>/', views.delete_feedback, name='delete_feedback'),
    path('add/', views.add_feedback, name='add_feedback'),
    path('update/<int:feedback_id>/', views.update_feedback, name='update_feedback'),
    path('export/csv/', views.export_feedback_csv, name='export_feedback_csv'),
    path('backup/', views.backup_data, name='backup_data'),
    path('restore/', views.restore_data, name='restore_data'),
    path('log-backup-download/', views.log_backup_download, name='log_backup_download'),
    path('log-csv-download/', views.log_csv_download, name='log_csv_download'),
    path('log-restore-operation/', views.log_restore_operation, name='log_restore_operation'),
    path('log-print-action/', views.log_print_action, name='log_print_action'),
    path('print-preview/', views.print_preview, name='print_preview'),
] 