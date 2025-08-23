from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('system', '0001_initial'),  # keep whatever is there as the last migration
    ]

    operations = [
        migrations.AddField(
            model_name='teacherevaluation',
            name='submitted_by',
            field=models.CharField(max_length=100, null=True, blank=True),
        ),
    ]
