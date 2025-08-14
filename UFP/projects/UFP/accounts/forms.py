from django import forms
from django_recaptcha.fields import ReCaptchaField

class StudentLoginForm(forms.Form):
    student_id = forms.CharField(
        max_length=20,
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'id': 'student_id',
        })
    )
    password = forms.CharField(
        required=True,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'id': 'password',
        })
    )
    captcha = ReCaptchaField()

class AdminLoginForm(forms.Form):
    username = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)
    captcha = ReCaptchaField()

class RegisterForm(forms.Form):
    student_id = forms.CharField(max_length=8)
    fullname = forms.CharField(max_length=150)
    email = forms.EmailField()
    department = forms.CharField()
    program = forms.CharField()
    password = forms.CharField(widget=forms.PasswordInput)
    confirm_password = forms.CharField(widget=forms.PasswordInput)
    captcha = ReCaptchaField()

