from django.shortcuts import render, redirect
from django.http import HttpResponse, JsonResponse
from django.contrib import messages
from django.contrib.admin.models import LogEntry, ADDITION, CHANGE, DELETION
from django.contrib.contenttypes.models import ContentType
from django.utils.encoding import smart_str
from django.db.models import Count
from datetime import datetime
import json
import csv

# Import models from the appropriate app
from system.models import StudentFeedback, Student, Service, Sentiment
from system.utils import log_student_activity

# CRUD/Feedback Management Views

def crud(request):
    return render(request, 'crud/feedback_management.html', {
        'admin_user': request.user,
    })


def student_feedback_view(request):
    print("=== student_feedback_view() CALLED ===")

    feedback_list = StudentFeedback.objects.select_related('student', 'service', 'sentiment').order_by('-timestamp')

    # Filtering
    student_id = request.GET.get('student')
    service_id = request.GET.get('service')
    sentiment_id = request.GET.get('sentiment')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    sentiment_service = request.GET.get('sentiment_service')

    if student_id and student_id != 'None':
        feedback_list = feedback_list.filter(student__studentID=student_id)
    if service_id and service_id != 'None':
        feedback_list = feedback_list.filter(service__serviceID=service_id)
    if sentiment_id and sentiment_id != 'None':
        feedback_list = feedback_list.filter(sentiment__sentimentID=sentiment_id)
    if date_from and date_from != 'None':
        feedback_list = feedback_list.filter(timestamp__date__gte=date_from)
    if date_to and date_to != 'None':
        feedback_list = feedback_list.filter(timestamp__date__lte=date_to)

    # Sentiment breakdown for the selected service in the dropdown
    if sentiment_service and sentiment_service != 'None':
        sentiment_counts = StudentFeedback.objects.filter(service__serviceID=sentiment_service)
        sentiment_counts = sentiment_counts.values('sentiment__sentimentName').annotate(count=Count('sentiment')).order_by('-count')
    else:
        sentiment_counts = feedback_list.values('sentiment__sentimentName').annotate(count=Count('sentiment')).order_by('-count')

    service_counts = feedback_list.values('service__serviceName').annotate(count=Count('service')).order_by('-count')
    total_count = feedback_list.count()

    return render(request, 'crud/feedback_management.html', {
        'students': Student.objects.all(),
        'services': Service.objects.all(),
        'sentiments': Sentiment.objects.all(),
        'feedback_list': feedback_list,
        'sentiment_counts': sentiment_counts,
        'service_counts': service_counts,
        'total_count': total_count,
        'selected_student': student_id,
        'selected_service': service_id,
        'selected_sentiment': sentiment_id,
        'date_from': date_from,
        'date_to': date_to,
        'sentiment_service': sentiment_service,
        'admin_user': request.user,
    })

def add_feedback(request):
    if request.method == 'POST':
        student_id = request.POST.get('student')
        service_id = request.POST.get('service')
        sentiment_id = request.POST.get('sentiment')
        comment = request.POST.get('comments')

        # Validate all required fields are present
        if not all([student_id, service_id, sentiment_id, comment]):
            messages.error(request, 'All fields are required.')
            return redirect('student_feedback_view')

        try:
            student = Student.objects.get(pk=student_id)
            service = Service.objects.get(pk=service_id)
            sentiment = Sentiment.objects.get(pk=sentiment_id)

            # Create the feedback
            feedback = StudentFeedback.objects.create(
                student=student,
                service=service,
                sentiment=sentiment,
                comments=comment
            )
            
            # Log student activity for feedback submission
            # log_student_activity(
            #     student=student,
            #     activity_type='FEEDBACK_SUBMIT',
            #     description=f'Submitted feedback for {service.serviceName} service',
            #     request=request,
            #     additional_data={
            #         'feedback_id': feedback.feedbackID,
            #         'service_name': service.serviceName,
            #         'sentiment_name': sentiment.sentimentName,
            #         'comment_length': len(comment)
            #     }
            # )
            
            messages.success(request, 'Feedback added successfully.')
            if request.user.is_authenticated and request.user.is_staff:
                LogEntry.objects.log_action(
                    user_id=request.user.pk,
                    content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                    object_id=student.pk,  # or the new feedback's pk if you want
                    object_repr=f"Feedback by {student.studentName}",
                    action_flag=ADDITION,
                    change_message="Added feedback."
                )
        except (Student.DoesNotExist, Service.DoesNotExist, Sentiment.DoesNotExist):
            messages.error(request, 'Invalid data provided. Feedback not added.')

    return redirect('student_feedback_view')


def delete_feedback(request, feedback_id):
    feedback = StudentFeedback.objects.get(pk=feedback_id)
    student_name = feedback.student.studentName
    feedback_id_pk = feedback.pk  # Store the ID before deletion
    
    # Log the action before deleting
    if request.user.is_authenticated and request.user.is_staff:
        LogEntry.objects.log_action(
            user_id=request.user.pk,
            content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
            object_id=feedback_id_pk,
            object_repr=f"Feedback by {feedback.student.studentName}",
            action_flag=DELETION,
            change_message="Deleted feedback."
        )
    
    feedback.delete()
    messages.success(request, f"🗑️ Feedback from {student_name} was deleted successfully.")
    return redirect('student_feedback_view')


def update_feedback(request, feedback_id):
    try:
        feedback = StudentFeedback.objects.get(pk=feedback_id)
    except StudentFeedback.DoesNotExist:
        messages.error(request, 'Feedback not found.')
        return redirect('student_feedback_view')

    if request.method == 'POST':
        try:
            feedback.student = Student.objects.get(pk=request.POST['student'])
            feedback.service = Service.objects.get(pk=request.POST['service'])
            feedback.sentiment = Sentiment.objects.get(pk=request.POST['sentiment'])
            feedback.comments = request.POST['comments']  # make sure this matches your field
            feedback.save()
            messages.success(request, 'Feedback updated successfully.')
            if request.user.is_authenticated and request.user.is_staff:
                LogEntry.objects.log_action(
                    user_id=request.user.pk,
                    content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                    object_id=feedback.pk,
                    object_repr=f"Feedback by {feedback.student.studentName}",
                    action_flag=CHANGE,
                    change_message="Updated feedback."
                )
            return redirect('student_feedback_view')
        except Exception as e:
            print("UPDATE ERROR:", e)
            messages.error(request, 'Invalid data provided. Update failed.')

    return render(request, 'update_feedback.html', {'feedback': feedback})


def export_feedback_csv(request):
    # Export the entire feedback table and the report summary, regardless of filters
    feedback_list = StudentFeedback.objects.select_related('student', 'service', 'sentiment').order_by('-timestamp')

    # Calculate summary
    total_count = feedback_list.count()
    sentiment_counts = feedback_list.values('sentiment__sentimentName').annotate(count=Count('sentiment')).order_by('-count')
    
    # Add count for records with no sentiment
    no_sentiment_count = feedback_list.filter(sentiment__isnull=True).count()
    if no_sentiment_count > 0:
        sentiment_counts = list(sentiment_counts)
        sentiment_counts.append({'sentiment__sentimentName': 'No Sentiment', 'count': no_sentiment_count})
        sentiment_counts.sort(key=lambda x: x['count'], reverse=True)
    
    service_counts = feedback_list.values('service__serviceName').annotate(count=Count('service')).order_by('-count')

    # Sentiment breakdown for each service
    all_sentiments = list(Sentiment.objects.values_list('sentimentName', flat=True)) + ['No Sentiment']
    service_sentiment_breakdown = []
    for service in Service.objects.all():
        breakdown = StudentFeedback.objects.filter(service=service)
        breakdown = breakdown.values('sentiment__sentimentName').annotate(count=Count('sentiment'))
        sentiment_map = {s['sentiment__sentimentName']: s['count'] for s in breakdown}
        
        # Count records with no sentiment
        no_sentiment_count = StudentFeedback.objects.filter(service=service, sentiment__isnull=True).count()
        sentiment_map['No Sentiment'] = no_sentiment_count
        
        row = [service.serviceName] + [sentiment_map.get(sent, 0) for sent in all_sentiments]
        service_sentiment_breakdown.append(row)

    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename=feedback_report.csv'

    writer = csv.writer(response)
    # Write summary section
    writer.writerow(['Report Summary'])
    writer.writerow(['Total Feedback', total_count])
    writer.writerow([])
    writer.writerow(['Sentiment Breakdown'])
    for s in sentiment_counts:
        writer.writerow([s['sentiment__sentimentName'], s['count']])
    writer.writerow([])
    writer.writerow(['Service Breakdown'])
    for s in service_counts:
        writer.writerow([s['service__serviceName'], s['count']])
    writer.writerow([])
    # Write sentiment breakdown for each service
    writer.writerow(['Sentiment Breakdown by Service'])
    writer.writerow(['Service'] + all_sentiments)
    for row in service_sentiment_breakdown:
        writer.writerow(row)
    writer.writerow([])
    # Write table header
    writer.writerow(['Student', 'Service', 'Sentiment', 'Comments', 'Timestamp'])
    for fb in feedback_list:
        writer.writerow([
            smart_str(fb.student.studentName),
            smart_str(fb.service.serviceName),
            smart_str(fb.sentiment.sentimentName if fb.sentiment else 'NULL'),
            smart_str(fb.comments),
            fb.timestamp.strftime('%Y-%m-%d %H:%M'),
        ])
    return response


def backup_data(request):
    """Create a backup of all feedback data"""
    try:
        # Get all feedback data
        feedback_data = StudentFeedback.objects.select_related('student', 'service', 'sentiment').all()
        
        # Prepare backup data
        backup = {
            'timestamp': datetime.now().isoformat(),
            'total_records': feedback_data.count(),
            'feedback': []
        }
        
        for feedback in feedback_data:
            backup['feedback'].append({
                'feedbackID': feedback.feedbackID,
                'studentID': feedback.student.studentID,
                'studentName': feedback.student.studentName,
                'serviceID': feedback.service.serviceID,
                'serviceName': feedback.service.serviceName,
                'sentimentID': feedback.sentiment.sentimentID if feedback.sentiment else None,
                'sentimentName': feedback.sentiment.sentimentName if feedback.sentiment else 'No Sentiment',
                'comments': feedback.comments,
                'timestamp': feedback.timestamp.isoformat()
            })
        
        # Create backup filename
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'feedback_backup_{timestamp}.backup'
        
        # Return backup file for download
        backup_content = json.dumps(backup, indent=2, ensure_ascii=False)
        response = HttpResponse(backup_content.encode('utf-8'), content_type='application/json')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        return JsonResponse({
            'success': False,
            'error': f'Backup failed: {str(e)}'
        })


def restore_data(request):
    """Restore data from a backup file"""
    if request.method == 'POST':
        try:
            # Check if file was uploaded
            if 'backup_file' not in request.FILES:
                return JsonResponse({
                    'success': False,
                    'error': 'No backup file selected.'
                })
            
            backup_file = request.FILES['backup_file']
            
            # Validate file type
            if not backup_file.name.endswith('.backup'):
                return JsonResponse({'error': 'Wrong file format'}, status=400)
            
            # Read and parse backup data
            backup_content = backup_file.read().decode('utf-8')
            backup_data = json.loads(backup_content)
            
            # Validate backup structure
            if 'feedback' not in backup_data:
                return JsonResponse({
                    'success': False,
                    'error': 'Invalid backup file format.'
                })
            
            # Clear existing feedback data
            StudentFeedback.objects.all().delete()
            
            # Restore feedback data
            restored_count = 0
            skipped_count = 0
            for feedback_item in backup_data['feedback']:
                try:
                    # Get related objects
                    student = Student.objects.get(studentID=feedback_item['studentID'])
                    service = Service.objects.get(serviceID=feedback_item['serviceID'])

                    # Handle sentiment (might be None or missing)
                    sentiment = None
                    sentiment_id = feedback_item.get('sentimentID')
                    if sentiment_id is not None and sentiment_id != '':
                        try:
                            sentiment = Sentiment.objects.get(sentimentID=sentiment_id)
                        except Sentiment.DoesNotExist:
                            sentiment = None

                    # Create feedback record with original timestamp
                    from datetime import datetime
                    original_timestamp = datetime.fromisoformat(feedback_item['timestamp'])

                    StudentFeedback.objects.create(
                        student=student,
                        service=service,
                        sentiment=sentiment,
                        comments=feedback_item['comments'],
                        timestamp=original_timestamp
                    )
                    restored_count += 1

                except (Student.DoesNotExist, Service.DoesNotExist) as e:
                    skipped_count += 1
                    print(f"Skipped record due to missing related data: {e}")
                    continue
                except Exception as e:
                    skipped_count += 1
                    print(f"Skipped record due to error: {e}")
                    continue

            return JsonResponse({
                'success': True,
                'message': f'Restore completed! {restored_count} records restored. {skipped_count} records skipped.',
                'restored_count': restored_count,
                'skipped_count': skipped_count
            })
            
        except json.JSONDecodeError:
            return JsonResponse({
                'success': False,
                'error': 'Invalid JSON file.'
            })
        except Exception as e:
            return JsonResponse({
                'success': False,
                'error': f'Restore failed: {str(e)}'
            })
    
    return JsonResponse({
        'success': False,
        'error': 'Invalid request method.'
    })


def log_backup_download(request):
    """Log backup download to database"""
    if request.method == 'POST':
        try:
            import json
            data = json.loads(request.body)
            filename = data.get('filename', 'unknown')
            
            if request.user.is_authenticated and request.user.is_staff:
                # Use the most recent feedback as a dummy object for logging
                feedback = StudentFeedback.objects.order_by('-timestamp').first()
                if feedback:
                    LogEntry.objects.log_action(
                        user_id=request.user.pk,
                        content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                        object_id=request.user.pk,
                        object_repr=str(request.user),
                        action_flag=CHANGE,
                        change_message=f"Downloaded backup: {filename}"
                    )
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


def log_csv_download(request):
    """Log CSV download to database"""
    if request.method == 'POST':
        try:
            import json
            data = json.loads(request.body)
            filename = data.get('filename', 'unknown')
            
            if request.user.is_authenticated and request.user.is_staff:
                feedback = StudentFeedback.objects.order_by('-timestamp').first()
                if feedback:
                    LogEntry.objects.log_action(
                        user_id=request.user.pk,
                        content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                        object_id=request.user.pk,
                        object_repr=str(request.user),
                        action_flag=CHANGE,
                        change_message=f"Downloaded CSV report: {filename}"
                    )
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


def log_restore_operation(request):
    """Log restore operation to database"""
    if request.method == 'POST':
        try:
            import json
            data = json.loads(request.body)
            message = data.get('message', 'Restore completed')
            restored_count = data.get('restored_count', 0)
            filename = data.get('filename', 'unknown')
            
            if request.user.is_authenticated and request.user.is_staff:
                feedback = StudentFeedback.objects.order_by('-timestamp').first()
                if feedback:
                    LogEntry.objects.log_action(
                        user_id=request.user.pk,
                        content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                        object_id=request.user.pk,
                        object_repr=str(request.user),
                        action_flag=CHANGE,
                        change_message=message
                    )
            
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})


def print_preview(request):
    """Review of feedback report"""
    # Get the same data as student_feedback_view but for print
    feedback_list = StudentFeedback.objects.select_related('student', 'service', 'sentiment').order_by('-timestamp')

    # Apply the same filters as the main view
    student_id = request.GET.get('student')
    service_id = request.GET.get('service')
    sentiment_id = request.GET.get('sentiment')
    date_from = request.GET.get('date_from')
    date_to = request.GET.get('date_to')
    if student_id and student_id != 'None':
        feedback_list = feedback_list.filter(student__studentID=student_id)
    if service_id and service_id != 'None':
        feedback_list = feedback_list.filter(service__serviceID=service_id)
    if sentiment_id and sentiment_id != 'None':
        feedback_list = feedback_list.filter(sentiment__sentimentID=sentiment_id)
    if date_from and date_from != 'None':
        feedback_list = feedback_list.filter(timestamp__date__gte=date_from)
    if date_to and date_to != 'None':
        feedback_list = feedback_list.filter(timestamp__date__lte=date_to)

    # Calculate summary statistics
    total_count = feedback_list.count()
    # Exclude null sentiments from the main sentiment_counts
    sentiment_counts = feedback_list.exclude(sentiment__isnull=True).values('sentiment__sentimentName').annotate(count=Count('sentiment')).order_by('-count')
    
    # Add count for records with no sentiment
    no_sentiment_count = feedback_list.filter(sentiment__isnull=True).count()
    if no_sentiment_count > 0:
        sentiment_counts = list(sentiment_counts)
        sentiment_counts.append({'sentiment__sentimentName': 'No Sentiment', 'count': no_sentiment_count})
        sentiment_counts.sort(key=lambda x: x['count'], reverse=True)
    
    service_counts = feedback_list.values('service__serviceName').annotate(count=Count('service')).order_by('-count')

    return render(request, 'crud/print_preview.html', {
      'feedback_list': feedback_list,
      'total_count': total_count,
      'sentiment_counts': sentiment_counts,
      'service_counts': service_counts,
      'date_from': date_from,
      'date_to': date_to,
      'generated_at': datetime.now(),
    })


def log_print_action(request):
    """Log print preview action to admin log"""
    if request.method == 'POST':
        try:
            if request.user.is_authenticated and request.user.is_staff:
                from django.contrib.admin.models import LogEntry, CHANGE
                from django.contrib.contenttypes.models import ContentType
                LogEntry.objects.log_action(
                    user_id=request.user.pk,
                    content_type_id=ContentType.objects.get_for_model(StudentFeedback).pk,
                    object_id=request.user.pk,
                    object_repr=str(request.user),
                    action_flag=CHANGE,
                    change_message="Printed feedback report from print preview."
                )
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})
    return JsonResponse({'success': False, 'error': 'Invalid request method'})
