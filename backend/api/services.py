"""Business logic and data access for the WebGIS API.

Views (routers) stay thin: they validate input via schemas, call these helpers,
and return models/querysets/dicts that the response schema serializes. ORM
queries, GEOS/GDAL work, and validation live here so they are testable without
HTTP and reusable across endpoints.
"""

import json
import os

from django.conf import settings
from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.geos import GEOSGeometry, Point, Polygon
from django.contrib.gis.measure import D
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from ninja.errors import HttpError
from osgeo import gdal, ogr, osr

from .models import DemoLine, DemoPoint, DemoPolygon


class InvalidGeometry(Exception):
    """Raised when a client-supplied GeoJSON geometry cannot be parsed."""


def parse_geometry(geojson: dict) -> GEOSGeometry:
    """Parse a GeoJSON geometry object into a GEOS geometry (SRID 4326)."""
    try:
        geom = GEOSGeometry(json.dumps(geojson))
    except Exception as exc:  # GEOSException, ValueError, TypeError, ...
        raise InvalidGeometry(str(exc)) from exc
    if geom.srid is None:
        geom.srid = 4326
    return geom


# --------------------------------------------------------------------------- #
# Points
# --------------------------------------------------------------------------- #
def create_point(payload) -> DemoPoint:
    return DemoPoint.objects.create(
        name=payload.name,
        description=payload.description,
        geom=Point(payload.lng, payload.lat, srid=4326),
    )


def apply_point_changes(point: DemoPoint, data: dict) -> DemoPoint:
    """Apply a (possibly partial) set of point fields and save."""
    if "name" in data:
        point.name = data["name"]
    if "description" in data:
        point.description = data["description"]
    if "lng" in data or "lat" in data:
        lng = data.get("lng", point.geom.x)
        lat = data.get("lat", point.geom.y)
        point.geom = Point(lng, lat, srid=4326)
    point.save()
    return point


def points_near(lng: float, lat: float, radius_meters: float):
    # `geom` is geometry in EPSG:4326, where raw distances are in degrees. The
    # "spheroid" option makes PostGIS compute true geodetic distance in meters
    # (ST_DWithin/ST_DistanceSpheroid), so the radius is interpreted correctly.
    point = Point(lng, lat, srid=4326)
    return DemoPoint.objects.filter(
        geom__distance_lte=(point, D(m=radius_meters), "spheroid")
    )


def nearest_point(lng: float, lat: float) -> dict | None:
    point = Point(lng, lat, srid=4326)
    nearest = (
        DemoPoint.objects.annotate(distance=Distance("geom", point, spheroid=True))
        .order_by("distance")
        .first()
    )
    if nearest is None:
        return None
    return {"id": nearest.id, "name": nearest.name, "distance_meters": nearest.distance.m}


# --------------------------------------------------------------------------- #
# Polygons / Lines
# --------------------------------------------------------------------------- #
def create_polygon(payload) -> DemoPolygon:
    return DemoPolygon.objects.create(
        name=payload.name, description=payload.description, geom=parse_geometry(payload.geojson)
    )


def create_line(payload) -> DemoLine:
    return DemoLine.objects.create(
        name=payload.name, description=payload.description, geom=parse_geometry(payload.geojson)
    )


def apply_geometry_changes(obj, data: dict):
    """Apply a (possibly partial) set of {name, description, geojson} fields and save."""
    if "name" in data:
        obj.name = data["name"]
    if "description" in data:
        obj.description = data["description"]
    if data.get("geojson") is not None:
        obj.geom = parse_geometry(data["geojson"])
    obj.save()
    return obj


def polygons_in_bbox(minx: float, miny: float, maxx: float, maxy: float):
    bbox = Polygon.from_bbox((minx, miny, maxx, maxy))
    return DemoPolygon.objects.filter(geom__intersects=bbox)


def polygon_areas() -> list[dict]:
    return [{"id": p.id, "name": p.name, "area": p.geom.area} for p in DemoPolygon.objects.all()]


def polygon_centroids() -> list[dict]:
    return [
        {"id": p.id, "name": p.name, "geojson": json.loads(p.geom.centroid.geojson)}
        for p in DemoPolygon.objects.all()
    ]


def simplify_polygons(tolerance: float) -> list[dict]:
    return [
        {
            "id": p.id,
            "name": p.name,
            "geojson": json.loads(p.geom.simplify(tolerance, preserve_topology=True).geojson),
        }
        for p in DemoPolygon.objects.all()
    ]


# --------------------------------------------------------------------------- #
# Spatial relationships & geometry operations
# --------------------------------------------------------------------------- #
def points_within(polygon: DemoPolygon):
    return DemoPoint.objects.filter(geom__within=polygon.geom)


def geometry_intersection(geom_a, geom_b) -> dict | None:
    result = geom_a.intersection(geom_b)
    return None if result.empty else json.loads(result.geojson)


def geometry_difference(geom_a, geom_b) -> dict | None:
    result = geom_a.difference(geom_b)
    return None if result.empty else json.loads(result.geojson)


def union_all_polygons() -> dict | None:
    polygons = list(DemoPolygon.objects.all())
    if not polygons:
        return None
    union = polygons[0].geom
    for poly in polygons[1:]:
        union = union.union(poly.geom)
    return json.loads(union.geojson)


def buffer_polygon(polygon: DemoPolygon, distance: float) -> dict:
    return json.loads(polygon.geom.buffer(distance).geojson)


# --------------------------------------------------------------------------- #
# GDAL (file-path based)
# --------------------------------------------------------------------------- #
def _safe_path(path: str, *, must_exist: bool = True) -> str:
    """Resolve ``path`` under GDAL_FILE_ROOT, rejecting traversal outside it.

    The GDAL endpoints take filesystem paths from the client; without this guard
    they would allow reading/writing arbitrary files on the host.
    """
    base = os.path.realpath(getattr(settings, "GDAL_FILE_ROOT", settings.MEDIA_ROOT))
    resolved = os.path.realpath(os.path.join(base, path))
    if resolved != base and not resolved.startswith(base + os.sep):
        raise HttpError(400, "Path is outside the permitted data directory")
    if must_exist and not os.path.exists(resolved):
        raise HttpError(404, "File not found")
    return resolved


def raster_stats(raster_path: str) -> dict:
    ds = gdal.Open(_safe_path(raster_path))
    if ds is None:
        raise HttpError(400, "Could not open raster")
    stats = ds.GetRasterBand(1).GetStatistics(True, True)
    return {"min": stats[0], "max": stats[1], "mean": stats[2], "stddev": stats[3]}


def pixel_value(raster_path: str, lng: float, lat: float) -> dict:
    ds = gdal.Open(_safe_path(raster_path))
    if ds is None:
        raise HttpError(400, "Could not open raster")
    gt = ds.GetGeoTransform()
    srs = osr.SpatialReference(wkt=ds.GetProjection())
    srs_latlon = osr.SpatialReference()
    srs_latlon.ImportFromEPSG(4326)
    transform = osr.CoordinateTransformation(srs_latlon, srs)
    x_geo, y_geo, _ = transform.TransformPoint(lng, lat)
    px = int((x_geo - gt[0]) / gt[1])
    py = int((y_geo - gt[3]) / gt[5])
    arr = ds.GetRasterBand(1).ReadAsArray(px, py, 1, 1)
    if arr is None:
        raise HttpError(400, "Coordinate is outside the raster extent")
    return {"value": float(arr[0][0])}


def clip_raster(raster_path: str, out_path: str, minx, miny, maxx, maxy) -> dict:
    src = _safe_path(raster_path)
    dst = _safe_path(out_path, must_exist=False)
    gdal.Translate(dst, src, projWin=[minx, maxy, maxx, miny])
    return {"output_path": dst}


def vector_schema(vector_path: str) -> dict:
    ds = ogr.Open(_safe_path(vector_path))
    if ds is None:
        raise HttpError(400, "Could not open vector dataset")
    layer = ds.GetLayer()
    return {"fields": [{"name": f.name, "type": f.GetTypeName()} for f in layer.schema]}


def raster_metadata(raster_path: str) -> dict:
    ds = gdal.Open(_safe_path(raster_path))
    if ds is None:
        raise HttpError(400, "Unable to open raster")
    return {
        "driver": ds.GetDriver().LongName,
        "size": [ds.RasterXSize, ds.RasterYSize],
        "bands": ds.RasterCount,
        "projection": ds.GetProjection(),
        "geotransform": list(ds.GetGeoTransform()),
    }


def upload_and_reproject(file) -> dict:
    input_path = default_storage.save(f"tmp/{file.name}", ContentFile(file.read()))
    ds = ogr.Open(default_storage.path(input_path))
    if ds is None:
        raise HttpError(400, "Could not open uploaded file")
    layer = ds.GetLayer()
    target_srs = osr.SpatialReference()
    target_srs.ImportFromEPSG(4326)
    transform = osr.CoordinateTransformation(layer.GetSpatialRef(), target_srs)
    features = []
    for feat in layer:
        geom = feat.GetGeometryRef()
        geom.Transform(transform)
        features.append(json.loads(geom.ExportToJson()))
    return {"features": features}
