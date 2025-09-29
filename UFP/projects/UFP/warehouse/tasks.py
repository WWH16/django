from celery import shared_task, chain, group
from system.models import Student, StudentFeedback, TeacherEvaluation
from warehouse.models import DimStudent, FactFeedback, DimService, DimSentiment, dim_teacher, fact_teacher_evaluation
from django.db import transaction
from django.conf import settings
import datetime
import os
from joblib import load
from wordcloud import WordCloud

# -------------------------
# 0️⃣ Load local SVM + TFIDF pipeline
# -------------------------
MODEL_PATH = os.path.join(settings.BASE_DIR, "warehouse", "model", "svm_tfidf_pipeline.pkl")
svm_pipeline = load(MODEL_PATH)
print(f"SVM + TFIDF pipeline loaded from {MODEL_PATH}")

# Map model predictions to labels
SENTIMENT_LABELS = {
    1: "Positive",
    2: "Neutral",
    3: "Negative"
}

def get_sentiment_label(text):
    """Predict sentiment using local SVM pipeline."""
    try:
        pred = svm_pipeline.predict([text])[0]
        return SENTIMENT_LABELS.get(pred, "Unknown")
    except Exception as e:
        print(f"Error predicting sentiment for '{text[:50]}...': {e}")
        return "Unknown"

# -------------------------
# 1️⃣ Sync new students
# -------------------------
def sync_students_task():
    existing_ids = set(DimStudent.objects.values_list('student_id', flat=True))
    new_students = Student.objects.exclude(studentID__in=existing_ids)

    dim_students = []
    for s in new_students:
        dim_students.append(
            DimStudent(
                student_id=s.studentID,
                student_name=s.studentName,
                program_id=s.program.programID if s.program else None,
                program_name=s.program.programName if s.program else None,
                department_id=s.program.department.departmentID if s.program and s.program.department else None,
                department_name=s.program.department.departmentName if s.program and s.program.department else None,
            )
        )

    if dim_students:
        with transaction.atomic():
            DimStudent.objects.bulk_create(dim_students)

    return f"Synced {len(dim_students)} new students."

# -------------------------
# 2️⃣ Process Student Feedback
# -------------------------
def run_feedback_to_warehouse_task(*args, **kwargs):
    processed_comments = set(FactFeedback.objects.values_list('comments', flat=True))
    new_feedbacks = StudentFeedback.objects.exclude(comments__in=processed_comments)

    if not new_feedbacks.exists():
        return "No new feedback to process."

    feedback_objs = []
    dim_sentiments_cache = {}
    dim_services_cache = {}
    dim_students_cache = {s.student_id: s for s in DimStudent.objects.all()}

    for fb in new_feedbacks:
        sentiment_label = get_sentiment_label(fb.comments)

        # Cache DimSentiment objects
        if sentiment_label not in dim_sentiments_cache:
            sentiment_obj, _ = DimSentiment.objects.get_or_create(label=sentiment_label)
            dim_sentiments_cache[sentiment_label] = sentiment_obj
        else:
            sentiment_obj = dim_sentiments_cache[sentiment_label]

        # Cache DimService objects
        service_name = fb.service.serviceName
        if service_name not in dim_services_cache:
            service_obj, _ = DimService.objects.get_or_create(service_name=service_name)
            dim_services_cache[service_name] = service_obj
        else:
            service_obj = dim_services_cache[service_name]

        student_obj = dim_students_cache.get(fb.student.studentID) if fb.student else None

        feedback_objs.append(
            FactFeedback(
                student=student_obj,
                service=service_obj,
                sentiment=sentiment_obj,
                timestamp=fb.timestamp,
                comments=fb.comments,
                comment_length=len(fb.comments)
            )
        )

    if feedback_objs:
        with transaction.atomic():
            FactFeedback.objects.bulk_create(feedback_objs)

    return f"Processed {len(feedback_objs)} feedback entries into warehouse."


# -------------------------
# 3️⃣ Process Teacher Evaluation
# -------------------------
def run_teacher_eval_to_warehouse_task(*args, **kwargs):
    processed_comments = set(fact_teacher_evaluation.objects.values_list('comments', flat=True))
    new_evals = TeacherEvaluation.objects.exclude(comments__in=processed_comments)

    if not new_evals.exists():
        return "No new teacher evaluations to process."

    eval_objs = []
    dim_sentiments_cache = {}
    dim_teachers_cache = {t.teacher_id: t for t in dim_teacher.objects.all()}

    for ev in new_evals:
        sentiment_label = get_sentiment_label(ev.comments)

        # Cache DimSentiment objects
        if sentiment_label not in dim_sentiments_cache:
            sentiment_obj, _ = DimSentiment.objects.get_or_create(label=sentiment_label)
            dim_sentiments_cache[sentiment_label] = sentiment_obj
        else:
            sentiment_obj = dim_sentiments_cache[sentiment_label]

        teacher_obj = dim_teachers_cache.get(ev.teacher.teacher_id) if ev.teacher else None

        eval_objs.append(
            fact_teacher_evaluation(
                teacher=teacher_obj,
                sentiment=sentiment_obj,
                timestamp=ev.timestamp,
                comments=ev.comments,
                comment_length=len(ev.comments)
            )
        )

    if eval_objs:
        with transaction.atomic():
            fact_teacher_evaluation.objects.bulk_create(eval_objs)

    return f"Processed {len(eval_objs)} teacher evaluations into warehouse."

# -------------------------
# 4️⃣ Chain tasks
# -------------------------
@shared_task
def Process_all_Data(*args, **kwargs):
    # 1️⃣ Sync new students
    student_result = sync_students_task()
    print(student_result)

    # 2️⃣ Process new student feedback
    feedback_result = run_feedback_to_warehouse_task()
    print(feedback_result)

    # 3️⃣ Process new teacher evaluations
    teacher_result = run_teacher_eval_to_warehouse_task()
    print(teacher_result)

    # 4️⃣ Determine if WordClouds should be generated
    feedback_has_new = "No new feedback" not in feedback_result
    teacher_has_new = "No new teacher evaluations" not in teacher_result

    if feedback_has_new or teacher_has_new:
        # Only generate WordClouds if there is new data
        wc_tasks = []
        if feedback_has_new:
            wc_tasks.append(generate_feedback_wordcloud_task.s())
        if teacher_has_new:
            wc_tasks.append(generate_teacher_eval_wordcloud_task.s())

        # Execute WordCloud tasks in parallel asynchronously
        from celery import group
        group(wc_tasks).apply_async()
        print("WordCloud generation tasks dispatched.")
    else:
        print("No new feedback or teacher evaluations. Skipping WordCloud generation.")

    return "Sync + feedback + teacher evaluations + wordclouds processed."



# -------------------------
# 5️⃣ Cleanup invalid sentiments
# -------------------------
def cleanup_invalid_sentiments():
    invalid_labels = ['text', 'sentiment', '']
    invalid_sentiments = DimSentiment.objects.filter(label__in=invalid_labels)
    count = invalid_sentiments.count()
    if count > 0:
        unknown_sentiment, _ = DimSentiment.objects.get_or_create(label="Unknown")
        FactFeedback.objects.filter(sentiment__in=invalid_sentiments).update(sentiment=unknown_sentiment)
        fact_teacher_evaluation.objects.filter(sentiment__in=invalid_sentiments).update(sentiment=unknown_sentiment)
        invalid_sentiments.delete()
    return f"Cleaned up {count} invalid sentiment records."

# -------------------------
# 6️⃣ WordCloud tasks
# -------------------------
def generate_wordcloud(text_list, filename):
    if not text_list:
        return None
    text = " ".join(text_list)
    wordcloud = WordCloud(width=800, height=400, background_color="white", colormap="Greens").generate(text)
    output_dir = os.path.join(settings.MEDIA_ROOT, "wordclouds")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, filename)
    wordcloud.to_file(output_path)
    print(f"WordCloud saved at {output_path}")
    return os.path.join(settings.MEDIA_URL, "wordclouds", filename).replace("\\", "/")

@shared_task
def generate_feedback_wordcloud_task():
    all_comments = [fb.comments for fb in StudentFeedback.objects.all() if fb.comments]
    if not all_comments:
        return "No feedback to generate WordCloud."
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"feedback_wordcloud_{timestamp}.png"
    return generate_wordcloud(all_comments, filename)

@shared_task
def generate_teacher_eval_wordcloud_task():
    all_comments = [ev.comments for ev in TeacherEvaluation.objects.all() if ev.comments]
    if not all_comments:
        return "No teacher evaluations to generate WordCloud."
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"teacher_eval_wordcloud_{timestamp}.png"
    return generate_wordcloud(all_comments, filename)
