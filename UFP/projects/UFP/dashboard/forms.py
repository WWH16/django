from django import forms
from system.models import TeacherEvaluation

class TeacherEvaluationForm(forms.ModelForm):
    class Meta:
        model = TeacherEvaluation
        fields = ['comments', 'is_anonymous']  # Fields students can fill out
        widgets = {
            'comments': forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'Enter your comments here...'}),
            'is_anonymous': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
        labels = {
            'comments': 'Your Comments',
            'is_anonymous': 'Submit Anonymously',
        }
