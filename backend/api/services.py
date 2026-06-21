"""Business logic and data access for the WebGIS API.

Views (routers) stay thin: they validate input via schemas, call these helpers,
and return models/querysets/dicts that the response schema serializes. ORM
queries, GEOS/GDAL work, and validation live here so they are testable without
HTTP and reusable across endpoints.
"""

import json
import math
import os
import struct

from django.conf import settings
from django.contrib.gis.db.models import Union
from django.contrib.gis.db.models.functions import (
    Area,
    AsGeoJSON,
    Centroid,
    Distance,
    GeomOutputGeoFunc,
    Transform,
)
from django.contrib.gis.gdal import CoordTransform, SpatialReference
from django.contrib.gis.geos import GEOSGeometry, Point, Polygon
from django.contrib.gis.measure import D
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from ninja.errors import HttpError
from osgeo import gdal, ogr, osr

from .models import DemoLine, DemoPoint, DemoPolygon


class InvalidGeometry(Exception):
    """Raised when a client-supplied GeoJSON geometry cannot be parsed."""


# A global equal-area projection (NSIDC EASE-Grid 2.0 Global, metres). Areas are
# computed by reprojecting to this from EPSG:4326 so the result is real square
# metres rather than meaningless square degrees, and it stays valid worldwide
# (unlike a region-specific projection such as US-only EPSG:5070).
EQUAL_AREA_SRID = 6933


class SimplifyPreserveTopology(GeomOutputGeoFunc):
    """Wraps PostGIS ``ST_SimplifyPreserveTopology`` so simplification runs in
    the database instead of pulling every geometry into Python."""

    function = "ST_SimplifyPreserveTopology"


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
    # `geom` is a geography column, so `dwithin` takes a real metric distance and
    # uses the spatial index (ST_DWithin on geography is spheroidal, in metres).
    point = Point(lng, lat, srid=4326)
    return DemoPoint.objects.filter(geom__dwithin=(point, D(m=radius_meters)))


def nearest_point(lng: float, lat: float) -> dict | None:
    point = Point(lng, lat, srid=4326)
    # Distance on a geography column is already in metres on the spheroid.
    nearest = (
        DemoPoint.objects.annotate(distance=Distance("geom", point))
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
    # Area is computed in the DB, reprojected to an equal-area CRS so the value
    # is square metres (see EQUAL_AREA_SRID) rather than square degrees.
    qs = DemoPolygon.objects.annotate(area_m2=Area(Transform("geom", EQUAL_AREA_SRID)))
    return [{"id": p.id, "name": p.name, "area": p.area_m2.sq_m} for p in qs]


def polygon_centroids() -> list[dict]:
    # Centroid computed by PostGIS and serialized to GeoJSON in the DB.
    qs = DemoPolygon.objects.annotate(centroid_json=AsGeoJSON(Centroid("geom")))
    return [{"id": p.id, "name": p.name, "geojson": json.loads(p.centroid_json)} for p in qs]


def simplify_polygons(tolerance: float) -> list[dict]:
    # Simplification + GeoJSON serialization both run in PostGIS.
    qs = DemoPolygon.objects.annotate(
        simplified_json=AsGeoJSON(SimplifyPreserveTopology("geom", tolerance))
    )
    return [{"id": p.id, "name": p.name, "geojson": json.loads(p.simplified_json)} for p in qs]


# --------------------------------------------------------------------------- #
# Spatial relationships & geometry operations
# --------------------------------------------------------------------------- #
def points_within(polygon: DemoPolygon):
    # `coveredby` rather than `within`: DemoPoint.geom is a geography column and
    # PostGIS geography supports ST_CoveredBy but not ST_Within. For a point,
    # "covered by the polygon" is equivalent to "within" (boundary included).
    return DemoPoint.objects.filter(geom__coveredby=polygon.geom)


def geometry_intersection(geom_a, geom_b) -> dict | None:
    result = geom_a.intersection(geom_b)
    return None if result.empty else json.loads(result.geojson)


def geometry_difference(geom_a, geom_b) -> dict | None:
    result = geom_a.difference(geom_b)
    return None if result.empty else json.loads(result.geojson)


def union_all_polygons() -> dict | None:
    # Single-query aggregate union in PostGIS instead of an O(n) Python fold.
    union = DemoPolygon.objects.aggregate(u=Union("geom"))["u"]
    if union is None:
        return None
    return json.loads(union.geojson)


def buffer_polygon(polygon: DemoPolygon, distance_meters: float) -> dict:
    """Buffer a polygon by a true metric distance, returning GeoJSON in 4326.

    The geometry is stored in EPSG:4326, whose units are degrees, so buffering
    it directly would treat ``distance_meters`` as degrees. Instead we project
    to a local azimuthal-equidistant CRS centred on the polygon (units = metres),
    buffer there, then project the result back to 4326.
    """
    geom = polygon.geom.clone()
    centroid = geom.centroid
    aeqd = SpatialReference(
        f"+proj=aeqd +lat_0={centroid.y} +lon_0={centroid.x} "
        f"+x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
    )
    wgs84 = SpatialReference(4326)
    geom.transform(CoordTransform(wgs84, aeqd))
    buffered = geom.buffer(distance_meters)
    buffered.transform(CoordTransform(aeqd, wgs84))
    return json.loads(buffered.geojson)


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
    # GDAL 3 honours each CRS's authority axis order; for EPSG:4326 that is
    # (lat, lon). Force traditional (lon, lat) order so we can pass and read
    # coordinates as (x=lon, y=lat) without silently swapping them.
    srs_latlon.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(srs_latlon, srs)
    x_geo, y_geo, _ = transform.TransformPoint(lng, lat)
    # floor (not int(), which truncates toward zero): a coordinate up to one
    # pixel west/north of the origin maps to a negative fraction, and int() would
    # round it to 0 and read the edge pixel instead of reporting out-of-extent.
    px = math.floor((x_geo - gt[0]) / gt[1])
    py = math.floor((y_geo - gt[3]) / gt[5])
    if not (0 <= px < ds.RasterXSize and 0 <= py < ds.RasterYSize):
        raise HttpError(400, "Coordinate is outside the raster extent")
    # ReadRaster (core bindings) rather than ReadAsArray, which needs the
    # optional gdal_array/NumPy C bridge that isn't always built. Read the one
    # pixel normalized to Float64 and unpack the 8 bytes.
    data = ds.GetRasterBand(1).ReadRaster(px, py, 1, 1, buf_type=gdal.GDT_Float64)
    if data is None:
        raise HttpError(400, "Could not read raster value at coordinate")
    return {"value": struct.unpack("d", data)[0]}


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
    # Emit (lon, lat) GeoJSON regardless of the authority axis order GDAL 3
    # would otherwise apply to EPSG:4326 (which is lat, lon).
    target_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    source_srs = layer.GetSpatialRef()
    source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    transform = osr.CoordinateTransformation(source_srs, target_srs)
    features = []
    for feat in layer:
        geom = feat.GetGeometryRef()
        geom.Transform(transform)
        features.append(json.loads(geom.ExportToJson()))
    return {"features": features}
