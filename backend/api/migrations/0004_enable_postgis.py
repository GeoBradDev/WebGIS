from django.contrib.postgres.operations import CreateExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Enable the PostGIS extension before any geometry column is created.

    The local postgis/postgis image already has it, but DO Managed Postgres (and
    a vanilla Postgres) needs `CREATE EXTENSION postgis` run first. `run_before`
    slots this ahead of 0002 (which creates the first geometry columns) without
    having to edit that migration. CreateExtension emits CREATE EXTENSION IF NOT
    EXISTS, so it is safe to (re-)run.
    """

    dependencies = [
        ('api', '0001_initial'),
    ]

    run_before = [
        ('api', '0002_demopoint_demopolygon'),
    ]

    operations = [
        CreateExtension('postgis'),
    ]
