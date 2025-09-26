from celery import shared_task, chain
from system.models import Student, StudentFeedback
from warehouse.models import DimStudent, FactFeedback, DimService, DimSentiment
from django.db import transaction
import requests
import datetime

# -------------------------
# 0️⃣ Simple test task
# -------------------------
@shared_task(ignore_result=False)
def print_hello():
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"Hello from Celery at {now}")
    return f"Executed at {now}"

# -------------------------
# Hugging Face API config
# -------------------------
HF_API_URL = "https://huggingface.co/spaces/CEENNNNNN/UFP_MODEL/api/predict"
HF_API_TOKEN = "<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>"  # optional if private
HEADERS = {"Authorization": f"Bearer {HF_API_TOKEN}"} if HF_API_TOKEN else {}
BATCH_SIZE = 50  # adjust depending on API/system

# -------------------------
# 1️⃣ Sync new students
# -------------------------
@shared_task
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
# 2️⃣ Process new feedback and insert into warehouse
# -------------------------
@shared_task
def run_model_to_warehouse_task(*args, **kwargs):
    # Get IDs of feedback already in warehouse
    processed_ids = set(FactFeedback.objects.values_list('feedback_id', flat=True))

    # Only feedback with null sentiment AND not yet in warehouse
    new_feedbacks = StudentFeedback.objects.filter(sentiment__isnull=True).exclude(feedbackID__in=processed_ids)

    if not new_feedbacks.exists():
        print("No new feedback to process.")
        return "No new feedback to process."

    new_feedbacks = list(new_feedbacks)

    for i in range(0, len(new_feedbacks), BATCH_SIZE):
        batch = new_feedbacks[i:i + BATCH_SIZE]
        payload = {"data": [fb.comments for fb in batch]}

        print(f"Sending batch {i} to Hugging Face API...")
        response = requests.post(HF_API_URL, headers=HEADERS, json=payload)

        if response.status_code != 200:
            print(f"Error processing batch starting at {i}: {response.text}")
            continue

        predictions = response.json().get("data", [])
        print(f"Received predictions: {predictions}")

        warehouse_rows = []
        for fb, label in zip(batch, predictions):
            sentiment_obj, _ = DimSentiment.objects.get_or_create(label=label)
            service_obj = DimService.objects.get(service_name=fb.service.serviceName)
            student_obj = DimStudent.objects.filter(student_id=fb.student.studentID).first() if fb.student else None

            warehouse_rows.append(
                FactFeedback(
                    feedback_id=fb.feedbackID,
                    student=student_obj,
                    service=service_obj,
                    sentiment=sentiment_obj,
                    timestamp=fb.timestamp,
                    comment_length=len(fb.comments),
                    comments=fb.comments
                )
            )

        if warehouse_rows:
            with transaction.atomic():
                FactFeedback.objects.bulk_create(warehouse_rows)

    return f"Processed {len(new_feedbacks)} new feedback entries into warehouse."

# -------------------------
# 3️⃣ Chain tasks
# -------------------------
@shared_task
def sync_then_model_to_warehouse(*args, **kwargs):
    """
    Chain:
    1. Sync students
    2. Run model to warehouse (ignores previous result)
    """
    chain(
        sync_students_task.s(),         # normal signature
        run_model_to_warehouse_task.si()  # immutable signature, ignores previous result
    )()
