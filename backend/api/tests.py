"""Tests for the WebGIS demo API.

Run with ``pytest`` (configured via ``pytest.ini`` + ``pytest-django``). They
require a PostGIS-capable database, the same one the app uses; Django builds an
isolated ``test_<db>`` from it. These double as worked examples of the endpoint
and service patterns the template uses, so a forker can copy them.
"""

import json

import pytest
from ninja.errors import HttpError

from api import services
from api.models import DemoPoint
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
    assert areas[0]["area"] == pytest.approx(1.0)  # 1x1 square (degree units)
    centroids = client.get("/api/polygons/centroids").json()
    assert centroids[0]["geojson"]["type"] == "Point"


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
    # buffer -> non-empty
    assert client.get(f"/api/spatial/buffer/{a.id}", {"buffer_meters": 0.1}).json()["geojson"]


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


def test_safe_path_rejects_traversal():
    # The GDAL file-path guard must reject paths escaping GDAL_FILE_ROOT.
    with pytest.raises(HttpError):
        services._safe_path("../../etc/passwd", must_exist=False)
