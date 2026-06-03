"""Spatial relationship queries and geometry operations."""

from typing import List

from django.shortcuts import get_object_or_404
from ninja import Router

from .. import services
from ..models import DemoPolygon
from ..schemas import GeometryResultOut, Message, NearestPointOut, PointOut

router = Router()


@router.get("/points-in-polygon/{polygon_id}", response=List[PointOut], tags=["Spatial"])
def points_in_polygon(request, polygon_id: int):
    """Points contained within the given polygon."""
    polygon = get_object_or_404(DemoPolygon, id=polygon_id)
    return services.points_within(polygon)


@router.get("/nearest-point", response={200: NearestPointOut, 404: Message}, tags=["Spatial"])
def nearest_point(request, lng: float, lat: float):
    """Nearest point to a location, with its distance in meters."""
    result = services.nearest_point(lng, lat)
    if result is None:
        return 404, {"detail": "No points found"}
    return 200, result


@router.get("/intersection/{poly1_id}/{poly2_id}", response=GeometryResultOut, tags=["Spatial"])
def intersection(request, poly1_id: int, poly2_id: int):
    poly1 = get_object_or_404(DemoPolygon, id=poly1_id)
    poly2 = get_object_or_404(DemoPolygon, id=poly2_id)
    return {"geojson": services.geometry_intersection(poly1.geom, poly2.geom)}


@router.get("/difference/{poly1_id}/{poly2_id}", response=GeometryResultOut, tags=["Spatial"])
def difference(request, poly1_id: int, poly2_id: int):
    poly1 = get_object_or_404(DemoPolygon, id=poly1_id)
    poly2 = get_object_or_404(DemoPolygon, id=poly2_id)
    return {"geojson": services.geometry_difference(poly1.geom, poly2.geom)}


@router.get("/union", response=GeometryResultOut, tags=["Spatial"])
def union_all_polygons(request):
    """Union of all polygons."""
    return {"geojson": services.union_all_polygons()}


@router.get("/buffer/{polygon_id}", response=GeometryResultOut, tags=["Spatial"])
def buffer_polygon(request, polygon_id: int, buffer_meters: float):
    polygon = get_object_or_404(DemoPolygon, id=polygon_id)
    return {"geojson": services.buffer_polygon(polygon, buffer_meters)}
