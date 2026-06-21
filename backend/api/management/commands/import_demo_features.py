"""Import demo polygons from an OGR-readable file via GeoDjango's LayerMapping.

This is the reference pattern for loading external spatial data (shapefiles,
GeoJSON, GeoPackage, ...) into a GeoDjango model. With no arguments it loads the
bundled ``sample_data/demo_polygons.geojson`` so it runs out of the box:

    python manage.py import_demo_features

Point it at your own data (any format GDAL/OGR can read) with ``--path``:

    python manage.py import_demo_features --path /data/parcels.shp

Re-running appends rows; pass ``--clear`` to replace the existing demo polygons.
"""

from pathlib import Path

from django.contrib.gis.utils import LayerMapping
from django.core.management.base import BaseCommand, CommandError

from api.models import DemoPolygon

# Bundled sample lives at backend/api/sample_data/demo_polygons.geojson
SAMPLE_PATH = Path(__file__).resolve().parents[2] / "sample_data" / "demo_polygons.geojson"

# Maps DemoPolygon fields -> source layer fields. The geometry entry's value is
# the source layer's OGR geometry type ("POLYGON" here); the others are the
# GeoJSON property names. `created_at` is server-managed (auto_now_add), so it is
# not mapped.
MAPPING = {
    "name": "name",
    "description": "description",
    "geom": "POLYGON",
}


class Command(BaseCommand):
    help = "Load demo polygons into the database using GeoDjango LayerMapping."

    def add_arguments(self, parser):
        parser.add_argument(
            "--path",
            default=str(SAMPLE_PATH),
            help="OGR-readable source file (defaults to the bundled GeoJSON sample).",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Delete existing DemoPolygon rows before importing.",
        )

    def handle(self, *args, **options):
        source = options["path"]
        if not Path(source).exists():
            raise CommandError(f"Source file not found: {source}")

        if options["clear"]:
            deleted, _ = DemoPolygon.objects.all().delete()
            self.stdout.write(f"Cleared {deleted} existing DemoPolygon rows.")

        before = DemoPolygon.objects.count()
        # transform=False: the sample is already EPSG:4326, matching the model
        # field's SRID. For reprojecting source data, drop this and LayerMapping
        # transforms the source SRS into the field's SRID on import.
        lm = LayerMapping(DemoPolygon, source, MAPPING, transform=False)
        lm.save(strict=True, verbose=False)
        imported = DemoPolygon.objects.count() - before

        self.stdout.write(
            self.style.SUCCESS(
                f"Imported {imported} DemoPolygon features from {Path(source).name}."
            )
        )