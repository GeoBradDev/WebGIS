"""Tests for the WebGIS demo API.

Run with ``pytest`` (configured via ``pytest.ini`` + ``pytest-django``). They
require a PostGIS-capable database, the same one the app uses; Django builds an
isolated ``test_<db>`` from it. These double as worked examples of the endpoint
and service patterns the template uses, so a forker can copy them.
"""

import json

import pytest
from django.test import override_settings
from ninja.errors import HttpError

from api import services
from api.models import DemoPoint, DemoPolygon
from api.schemas import PointIn, PolygonIn

# Every test in this module touches the ORM / DB.
pytestmark = pytest.mark.django_db

# Reusable GeoJSON fixtures (EPSG:4326).
SQUARE = {"type": "Polygon", "coordinates": [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]]}
BIG_SQUARE = {"type": "Polygon", "coordinates": [[[0, 0], [0, 2], [2, 2], [2, 0], [0, 0]]]}
LINE = {"type": "LineString", "coordinates": [[0, 0], [1, 1]]}


def _post(client, url, payload):
    """POST a JSON body to a Ninja endpoint."""
    return client.post(url, data=json.dumps(payload), content_type="application/json")


# --------------------------------------------------------------------------- #
# Points: CRUD
# --------------------------------------------------------------------------- #
def test_create_point(client):
    resp = _post(
        client, "/api/points", {"name": "A", "description": "first", "lng": 10.0, "lat": 20.0}
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "A"
    assert body["description"] == "first"
    assert body["lng"] == 10.0 and body["lat"] == 20.0
    assert "created_at" in body  # server-managed timestamp is exposed
    assert DemoPoint.objects.count() == 1


def test_create_point_description_defaults_blank(client):
    resp = _post(client, "/api/points", {"name": "A", "lng": 0, "lat": 0})
    assert resp.status_code == 201
    assert resp.json()["description"] == ""


def test_list_points_is_paginated(client):
    for i in range(3):
        services.create_point(PointIn(name=f"p{i}", lng=float(i), lat=0.0))
    resp = client.get("/api/points")
    assert resp.status_code == 200
    body = resp.json()
    assert body["count"] == 3
    assert len(body["items"]) == 3


def test_get_point_404(client):
    assert client.get("/api/points/9999").status_code == 404


def test_update_then_patch_point(client):
    point = services.create_point(PointIn(name="orig", lng=1.0, lat=2.0))
    put = client.put(
        f"/api/points/{point.id}",
        data=json.dumps({"name": "new", "description": "d", "lng": 3.0, "lat": 4.0}),
        content_type="application/json",
    )
    assert put.status_code == 200
    assert put.json()["lng"] == 3.0
    patch = client.patch(
        f"/api/points/{point.id}",
        data=json.dumps({"name": "patched"}),
        content_type="application/json",
    )
    assert patch.status_code == 200
    body = patch.json()
    assert body["name"] == "patched"
    assert body["lng"] == 3.0  # untouched by the partial update


def test_delete_point(client):
    point = services.create_point(PointIn(name="x", lng=0.0, lat=0.0))
    assert client.delete(f"/api/points/{point.id}").status_code == 204
    assert DemoPoint.objects.count() == 0


# --------------------------------------------------------------------------- #
# Points: spatial queries
# --------------------------------------------------------------------------- #
def test_points_near_filters_by_geodetic_radius(client):
    services.create_point(PointIn(name="close", lng=0.0, lat=0.0))
    services.create_point(PointIn(name="far", lng=10.0, lat=10.0))
    resp = client.get("/api/points/near", {"lng": 0.0, "lat": 0.0, "radius_meters": 1000})
    assert resp.status_code == 200
    names = {f["name"] for f in resp.json()}
    assert names == {"close"}


def test_nearest_point(client):
    services.create_point(PointIn(name="close", lng=0.0, lat=0.0))
    services.create_point(PointIn(name="far", lng=10.0, lat=10.0))
    resp = client.get("/api/spatial/nearest-point", {"lng": 0.0, "lat": 0.0})
    assert resp.status_code == 200
    body = resp.json()
    assert body["name"] == "close"
    assert body["distance_meters"] >= 0


def test_nearest_point_404_when_empty(client):
    assert client.get("/api/spatial/nearest-point", {"lng": 0.0, "lat": 0.0}).status_code == 404


# --------------------------------------------------------------------------- #
# Polygons: CRUD, validation, analytics
# --------------------------------------------------------------------------- #
def test_create_polygon_geojson_roundtrip(client):
    resp = _post(client, "/api/polygons", {"name": "sq", "geojson": SQUARE})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "sq"
    assert body["geojson"]["type"] == "Polygon"


def test_create_polygon_invalid_geometry_is_422(client):
    resp = _post(
        client,
        "/api/polygons",
        {"name": "bad", "geojson": {"type": "Polygon", "coordinates": "nonsense"}},
    )
    assert resp.status_code == 422
    assert "Invalid GeoJSON geometry" in resp.json()["detail"]


def test_polygon_areas_and_centroids(client):
    services.create_polygon(PolygonIn(name="sq", geojson=SQUARE))
    areas = client.get("/api/polygons/areas").json()
    # A 1deg x 1deg cell at the equator is ~12,300 km^2; assert real square
    # metres (not the ~1.0 a degree-units area would give).
    assert areas[0]["area"] == pytest.approx(1.23e10, rel=0.05)
    centroids = client.get("/api/polygons/centroids").json()
    assert centroids[0]["geojson"]["type"] == "Point"
    assert centroids[0]["geojson"]["coordinates"] == [0.5, 0.5]


def test_polygons_bbox_filter(client):
    services.create_polygon(PolygonIn(name="sq", geojson=SQUARE))
    hit = client.get("/api/polygons/bbox", {"minx": 0.5, "miny": 0.5, "maxx": 1.5, "maxy": 1.5})
    assert len(hit.json()) == 1
    miss = client.get("/api/polygons/bbox", {"minx": 5, "miny": 5, "maxx": 6, "maxy": 6})
    assert len(miss.json()) == 0


# --------------------------------------------------------------------------- #
# Spatial relationships & geometry operations
# --------------------------------------------------------------------------- #
def test_points_in_polygon(client):
    poly = services.create_polygon(PolygonIn(name="sq", geojson=SQUARE))
    services.create_point(PointIn(name="in", lng=0.5, lat=0.5))
    services.create_point(PointIn(name="out", lng=5.0, lat=5.0))
    resp = client.get(f"/api/spatial/points-in-polygon/{poly.id}")
    assert resp.status_code == 200
    assert [f["name"] for f in resp.json()] == ["in"]


def test_intersection_difference_union_buffer(client):
    a = services.create_polygon(PolygonIn(name="a", geojson=SQUARE))  # 0..1
    b = services.create_polygon(PolygonIn(name="b", geojson=BIG_SQUARE))  # 0..2 (contains a)
    # a ∩ b == a -> non-empty
    inter = client.get(f"/api/spatial/intersection/{a.id}/{b.id}").json()
    assert inter["geojson"]["type"] in ("Polygon", "MultiPolygon")
    # a - b == empty -> null geojson
    diff = client.get(f"/api/spatial/difference/{a.id}/{b.id}").json()
    assert diff["geojson"] is None
    # union of all polygons -> non-empty
    assert client.get("/api/spatial/union").json()["geojson"] is not None
    # buffer by a real metric distance -> a polygon expanded outward past 0..1
    buffered = client.get(f"/api/spatial/buffer/{a.id}", {"buffer_meters": 10000}).json()["geojson"]
    assert buffered is not None
    assert buffered["type"] in ("Polygon", "MultiPolygon")
    xs = [pt[0] for ring in buffered["coordinates"] for pt in ring]
    assert min(xs) < 0  # 10 km buffer pushes the 0..1 square's west edge below 0


# --------------------------------------------------------------------------- #
# Query-parameter validation (Ninja returns 422 on constraint violations)
# --------------------------------------------------------------------------- #
def test_buffer_rejects_non_positive_distance(client):
    poly = services.create_polygon(PolygonIn(name="a", geojson=SQUARE))
    assert client.get(f"/api/spatial/buffer/{poly.id}", {"buffer_meters": 0}).status_code == 422
    assert client.get(f"/api/spatial/buffer/{poly.id}", {"buffer_meters": -5}).status_code == 422
    # a positive distance still succeeds
    assert client.get(f"/api/spatial/buffer/{poly.id}", {"buffer_meters": 1000}).status_code == 200


def test_points_near_rejects_bad_params(client):
    assert (
        client.get("/api/points/near", {"lng": 0, "lat": 0, "radius_meters": 0}).status_code == 422
    )  # non-positive radius
    assert (
        client.get("/api/points/near", {"lng": 0, "lat": 200, "radius_meters": 100}).status_code
        == 422
    )  # latitude out of range


def test_nearest_point_rejects_out_of_range(client):
    assert client.get("/api/spatial/nearest-point", {"lng": 999, "lat": 0}).status_code == 422


def test_simplify_rejects_non_positive_tolerance(client):
    assert client.get("/api/polygons/simplify", {"tolerance": 0}).status_code == 422
    assert client.get("/api/polygons/simplify", {"tolerance": -1}).status_code == 422


def test_bbox_rejects_inverted_or_out_of_range(client):
    # min must be < max
    assert (
        client.get(
            "/api/polygons/bbox", {"minx": 1, "miny": 0, "maxx": 0, "maxy": 1}
        ).status_code
        == 422
    )
    # latitude out of range
    assert (
        client.get(
            "/api/polygons/bbox", {"minx": 0, "miny": -100, "maxx": 1, "maxy": 1}
        ).status_code
        == 422
    )


# --------------------------------------------------------------------------- #
# Lines: CRUD
# --------------------------------------------------------------------------- #
def test_line_create_and_get(client):
    created = _post(client, "/api/lines", {"name": "l", "geojson": LINE})
    assert created.status_code == 201
    line_id = created.json()["id"]
    fetched = client.get(f"/api/lines/{line_id}")
    assert fetched.status_code == 200
    assert fetched.json()["geojson"]["type"] == "LineString"


# --------------------------------------------------------------------------- #
# Service-layer units (no HTTP)
# --------------------------------------------------------------------------- #
def test_parse_geometry_sets_srid():
    geom = services.parse_geometry(SQUARE)
    assert geom.srid == 4326
    assert geom.geom_type == "Polygon"


def test_parse_geometry_invalid_raises():
    with pytest.raises(services.InvalidGeometry):
        services.parse_geometry({"type": "Polygon", "coordinates": "bad"})


def test_nearest_point_returns_none_when_empty():
    assert services.nearest_point(0.0, 0.0) is None


def test_send_email_async_includes_html_alternative():
    from django.core import mail

    from api.tasks import send_email_async

    send_email_async(
        "Subject", "text body", "from@example.com", ["to@example.com"], html_message="<b>hi</b>"
    )
    assert len(mail.outbox) == 1
    msg = mail.outbox[0]
    assert msg.body == "text body"
    assert any(mimetype == "text/html" and "<b>hi</b>" in content for content, mimetype in msg.alternatives)


def test_custom_user_manager_creates_by_email():
    from django.contrib.auth import get_user_model

    User = get_user_model()
    user = User.objects.create_user(email="User@Example.com", password="pw", username="u1")
    assert user.email == "user@example.com"  # normalized + lowercased
    assert user.check_password("pw")
    assert not user.is_staff and not user.is_superuser

    admin = User.objects.create_superuser(email="Admin@Example.com", password="pw", username="a1")
    assert admin.is_staff and admin.is_superuser

    # email is the USERNAME_FIELD / natural key; lookup is case-insensitive
    assert User.objects.get_by_natural_key("user@EXAMPLE.com") == user

    with pytest.raises(ValueError):
        User.objects.create_user(email="", password="pw", username="u2")


def test_import_demo_features_command_loads_sample():
    # The LayerMapping management command loads the bundled GeoJSON sample.
    from django.core.management import call_command

    call_command("import_demo_features", "--clear")
    assert DemoPolygon.objects.count() == 3
    names = set(DemoPolygon.objects.values_list("name", flat=True))
    assert {"Downtown", "Forest Park", "Riverfront"} <= names
    downtown = DemoPolygon.objects.get(name="Downtown")
    assert downtown.geom.geom_type == "Polygon"
    assert downtown.geom.valid


def test_safe_path_rejects_traversal():
    # The GDAL file-path guard must reject paths escaping GDAL_FILE_ROOT.
    with pytest.raises(HttpError):
        services._safe_path("../../etc/passwd", must_exist=False)


def _make_utm_raster(path, lng, lat, value=42.0, size=100, pixel=100.0):
    """Write a constant-value GeoTIFF in UTM 15N centred on (lng, lat).

    Uses ReadRaster/WriteRaster only, so it doesn't need the gdal_array bridge.
    Returns nothing; writes the file at ``path``.
    """
    import struct

    from osgeo import gdal, osr

    utm = osr.SpatialReference()
    utm.ImportFromEPSG(32615)  # UTM zone 15N (covers St. Louis)
    utm.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    ll = osr.SpatialReference()
    ll.ImportFromEPSG(4326)
    ll.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    e, n, _ = osr.CoordinateTransformation(ll, utm).TransformPoint(lng, lat)
    ox, oy = e - (size / 2) * pixel, n + (size / 2) * pixel
    ds = gdal.GetDriverByName("GTiff").Create(path, size, size, 1, gdal.GDT_Float32)
    ds.SetGeoTransform([ox, pixel, 0, oy, 0, -pixel])
    ds.SetProjection(utm.ExportToWkt())
    buf = struct.pack("<%df" % (size * size), *([value] * (size * size)))
    ds.GetRasterBand(1).WriteRaster(0, 0, size, size, buf, buf_type=gdal.GDT_Float32)
    ds.FlushCache()
    ds = None


def test_pixel_value_reads_correct_location():
    """pixel_value samples the right pixel of a projected raster.

    Exercises the GDAL-3 axis-order handling: the lon/lat must project into the
    raster (a swapped lat/lon would land outside zone 15N's valid range).
    """
    import os

    from django.conf import settings

    os.makedirs(settings.GDAL_FILE_ROOT, exist_ok=True)
    path = os.path.join(settings.GDAL_FILE_ROOT, "pytest_utm.tif")
    try:
        _make_utm_raster(path, lng=-90.20, lat=38.63, value=42.0)
        # Centre of the raster -> the fill value.
        assert services.pixel_value("pytest_utm.tif", -90.20, 38.63)["value"] == pytest.approx(42.0)
        # A point well outside the 10 km raster footprint -> 400.
        with pytest.raises(HttpError):
            services.pixel_value("pytest_utm.tif", -90.40, 38.63)
    finally:
        if os.path.exists(path):
            os.remove(path)


def test_pixel_value_rejects_point_just_outside_origin():
    """A point under one pixel west/north of the origin is out of extent.

    Guards the floor-vs-int() fix: int() would truncate the negative pixel index
    to 0 and read the edge pixel instead of reporting the point as outside.
    """
    import os
    import struct

    from django.conf import settings
    from osgeo import gdal, osr

    os.makedirs(settings.GDAL_FILE_ROOT, exist_ok=True)
    path = os.path.join(settings.GDAL_FILE_ROOT, "pytest_wgs84.tif")
    # A WGS84 raster so pixel indices map straight to lon/lat. Origin (top-left)
    # at lon=0, lat=10; 0.1-degree pixels; columns span lon [0, 1].
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    size = 10
    try:
        ds = gdal.GetDriverByName("GTiff").Create(path, size, size, 1, gdal.GDT_Float32)
        ds.SetGeoTransform([0.0, 0.1, 0, 10.0, 0, -0.1])
        ds.SetProjection(srs.ExportToWkt())
        buf = struct.pack("<%df" % (size * size), *([7.0] * (size * size)))
        ds.GetRasterBand(1).WriteRaster(0, 0, size, size, buf, buf_type=gdal.GDT_Float32)
        ds.FlushCache()
        ds = None

        # Inside the first column/row -> the fill value.
        assert services.pixel_value("pytest_wgs84.tif", 0.05, 9.95)["value"] == pytest.approx(7.0)
        # Half a pixel WEST of the origin (lon -0.05) -> outside the extent.
        with pytest.raises(HttpError):
            services.pixel_value("pytest_wgs84.tif", -0.05, 9.95)
        # Half a pixel NORTH of the origin (lat 10.05) -> outside the extent.
        with pytest.raises(HttpError):
            services.pixel_value("pytest_wgs84.tif", 0.05, 10.05)
    finally:
        if os.path.exists(path):
            os.remove(path)


@override_settings(
    SOCIALACCOUNT_PROVIDERS={
        'google': {'APPS': [{'client_id': 'dummy.apps.googleusercontent.com', 'secret': '', 'key': ''}]}
    }
)
def test_google_provider_token_endpoint_is_wired(client):
    # The headless provider/token route must exist and validate input. A token
    # object with no access_token/id_token is rejected before any Google network
    # call, so this is deterministic and offline.
    resp = client.post(
        '/_allauth/app/v1/auth/provider/token',
        data=json.dumps({
            'provider': 'google',
            'process': 'login',
            'token': {'client_id': 'dummy.apps.googleusercontent.com'},
        }),
        content_type='application/json',
    )
    assert 400 <= resp.status_code < 500
