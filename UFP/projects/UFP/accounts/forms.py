from django import forms
from django_recaptcha.fields import ReCaptchaField

class StudentLoginForm(forms.Form):
    username = forms.CharField(max_length=150)
    password = forms.CharField(widget=forms.PasswordInput)
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

