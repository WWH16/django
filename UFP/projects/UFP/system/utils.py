from .models import StudentActivityLog

def log_student_activity(student, activity_type):
    """
    Utility function to log student login/logout activity.
    """
    return StudentActivityLog.objects.create(
        student=student,
        activity_type=activity_type
    )

def get_student_activity_summary(student, days=30):
    """
    Get activity summary for a student
    
    Args:
        student: Student instance
        days: Number of days to look back (default 30)
    
    Returns:
        dict: Summary of activities
    """
    from django.utils import timezone
    from datetime import timedelta
    
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)
    
    activities = StudentActivityLog.objects.filter(
        student=student,
        timestamp__range=(start_date, end_date)
    )
    
    summary = {
        'total_activities': activities.count(),
        'login_count': activities.filter(activity_type='student_logged_in').count(),
        'feedback_submissions': activities.filter(activity_type='student_provided_feedback').count(),
        'recent_activities': activities[:10],  # Last 10 activities
        'activity_by_type': {}
    }
    
    # Count activities by type
    for activity_type, _ in StudentActivityLog.ACTIVITY_CHOICES:
        summary['activity_by_type'][activity_type] = activities.filter(
            activity_type=activity_type
        ).count()
    
    return summary 