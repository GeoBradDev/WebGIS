"""CRUD + simple queries for the Point / Polygon / Line demo features.

Static sub-paths (e.g. /points/near, /polygons/areas) are declared before the
``/{id}`` routes so they resolve unambiguously.
"""

from typing import List

from django.shortcuts import get_object_or_404
from ninja import Query, Router
from ninja.errors import HttpError
from ninja.pagination import paginate

from .. import services
from ..models import DemoLine, DemoPoint, DemoPolygon
from ..schemas import (
    FeatureGeoJSONOut,
    GeometryPatch,
    LineIn,
    LineOut,
    PointIn,
    PointOut,
    PointPatch,
    PolygonAreaOut,
    PolygonIn,
    PolygonOut,
)

router = Router()


# --------------------------------------------------------------------------- #
# Points
# --------------------------------------------------------------------------- #
@router.get("/points", response=List[PointOut], tags=["Points"])
@paginate
def list_points(request):
    """List points (paginated)."""
    return DemoPoint.objects.all()


@router.get("/points/near", response=List[PointOut], tags=["Points"])
def points_near(
    request,
    lng: float = Query(..., ge=-180, le=180, description="Longitude (WGS84)"),
    lat: float = Query(..., ge=-90, le=90, description="Latitude (WGS84)"),
    radius_meters: float = Query(..., gt=0, description="Search radius in metres"),
):
    """Points within ``radius_meters`` of a location."""
    return services.points_near(lng, lat, radius_meters)


@router.post("/points", response={201: PointOut}, tags=["Points"])
def create_point(request, payload: PointIn):
    return 201, services.create_point(payload)


@router.get("/points/{point_id}", response=PointOut, tags=["Points"])
def get_point(request, point_id: int):
    return get_object_or_404(DemoPoint, id=point_id)


@router.put("/points/{point_id}", response=PointOut, tags=["Points"])
def update_point(request, point_id: int, payload: PointIn):
    point = get_object_or_404(DemoPoint, id=point_id)
    return services.apply_point_changes(point, payload.dict())


@router.patch("/points/{point_id}", response=PointOut, tags=["Points"])
def patch_point(request, point_id: int, payload: PointPatch):
    point = get_object_or_404(DemoPoint, id=point_id)
    return services.apply_point_changes(point, payload.dict(exclude_unset=True))


@router.delete("/points/{point_id}", response={204: None}, tags=["Points"])
def delete_point(request, point_id: int):
    get_object_or_404(DemoPoint, id=point_id).delete()
    return 204, None


# --------------------------------------------------------------------------- #
# Polygons
# --------------------------------------------------------------------------- #
@router.get("/polygons", response=List[PolygonOut], tags=["Polygons"])
@paginate
def list_polygons(request):
    """List polygons (paginated)."""
    return DemoPolygon.objects.all()


@router.get("/polygons/bbox", response=List[PolygonOut], tags=["Polygons"])
def polygons_in_bbox(
    request,
    minx: float = Query(..., ge=-180, le=180),
    miny: float = Query(..., ge=-90, le=90),
    maxx: float = Query(..., ge=-180, le=180),
    maxy: float = Query(..., ge=-90, le=90),
):
    """Polygons intersecting a bounding box."""
    if minx >= maxx or miny >= maxy:
        raise HttpError(422, "Invalid bbox: require minx < maxx and miny < maxy")
    return services.polygons_in_bbox(minx, miny, maxx, maxy)


@router.get("/polygons/areas", response=List[PolygonAreaOut], tags=["Polygons"])
def polygon_areas(request):
    return services.polygon_areas()


@router.get("/polygons/centroids", response=List[FeatureGeoJSONOut], tags=["Polygons"])
def polygon_centroids(request):
    return services.polygon_centroids()


@router.get("/polygons/simplify", response=List[FeatureGeoJSONOut], tags=["Polygons"])
def simplify_polygons(
    request,
    tolerance: float = Query(0.001, gt=0, description="Simplification tolerance in degrees"),
):
    return services.simplify_polygons(tolerance)


@router.post("/polygons", response={201: PolygonOut}, tags=["Polygons"])
def create_polygon(request, payload: PolygonIn):
    return 201, services.create_polygon(payload)


@router.get("/polygons/{polygon_id}", response=PolygonOut, tags=["Polygons"])
def get_polygon(request, polygon_id: int):
    return get_object_or_404(DemoPolygon, id=polygon_id)


@router.put("/polygons/{polygon_id}", response=PolygonOut, tags=["Polygons"])
def update_polygon(request, polygon_id: int, payload: PolygonIn):
    polygon = get_object_or_404(DemoPolygon, id=polygon_id)
    return services.apply_geometry_changes(polygon, payload.dict())


@router.patch("/polygons/{polygon_id}", response=PolygonOut, tags=["Polygons"])
def patch_polygon(request, polygon_id: int, payload: GeometryPatch):
    polygon = get_object_or_404(DemoPolygon, id=polygon_id)
    return services.apply_geometry_changes(polygon, payload.dict(exclude_unset=True))


@router.delete("/polygons/{polygon_id}", response={204: None}, tags=["Polygons"])
def delete_polygon(request, polygon_id: int):
    get_object_or_404(DemoPolygon, id=polygon_id).delete()
    return 204, None


# --------------------------------------------------------------------------- #
# Lines
# --------------------------------------------------------------------------- #
@router.get("/lines", response=List[LineOut], tags=["Lines"])
@paginate
def list_lines(request):
    """List lines (paginated)."""
    return DemoLine.objects.all()


@router.post("/lines", response={201: LineOut}, tags=["Lines"])
def create_line(request, payload: LineIn):
    return 201, services.create_line(payload)


@router.get("/lines/{line_id}", response=LineOut, tags=["Lines"])
def get_line(request, line_id: int):
    return get_object_or_404(DemoLine, id=line_id)


@router.put("/lines/{line_id}", response=LineOut, tags=["Lines"])
def update_line(request, line_id: int, payload: LineIn):
    line = get_object_or_404(DemoLine, id=line_id)
    return services.apply_geometry_changes(line, payload.dict())


@router.patch("/lines/{line_id}", response=LineOut, tags=["Lines"])
def patch_line(request, line_id: int, payload: GeometryPatch):
    line = get_object_or_404(DemoLine, id=line_id)
    return services.apply_geometry_changes(line, payload.dict(exclude_unset=True))


@router.delete("/lines/{line_id}", response={204: None}, tags=["Lines"])
def delete_line(request, line_id: int):
    get_object_or_404(DemoLine, id=line_id).delete()
    return 204, None
