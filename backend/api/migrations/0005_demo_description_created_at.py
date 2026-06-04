"""Add example non-geometry attributes to the demo feature models.

Shows how to extend a GeoDjango model: ``description`` is a plain editable
field, ``created_at`` a server-managed timestamp. ``created_at`` uses a one-off
``timezone.now`` default to backfill any pre-existing rows (``preserve_default=
False`` so new rows use ``auto_now_add`` instead).
"""

import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0003_demoline"),
    ]

    operations = [
        migrations.AddField(
            model_name="demopolygon",
            name="description",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="demopoint",
            name="description",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="demoline",
            name="description",
            field=models.CharField(blank=True, default="", max_length=500),
        ),
        migrations.AddField(
            model_name="demopolygon",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="demopoint",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="demoline",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, default=django.utils.timezone.now
            ),
            preserve_default=False,
        ),
    ]
