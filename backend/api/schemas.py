"""Pydantic (Ninja) schemas for the WebGIS API.

Conventions:
- Separate input (``*In`` / ``*Patch``) and output (``*Out``) schemas.
- ``ModelSchema`` derives fields from the Django model with an explicit
  ``fields`` allowlist; computed values (lng/lat, GeoJSON) use ``resolve_*``.
- Geometries are exchanged as real GeoJSON geometry **objects**, not strings.
"""

import json
from typing import Any, Optional

from ninja import Field, ModelSchema, Schema

from .models import DemoLine, DemoPoint, DemoPolygon

# A GeoJSON geometry object, e.g. {"type": "Point", "coordinates": [lng, lat]}.
GeoJSON = dict[str, Any]


class Message(Schema):
    """Generic detail message (used for error responses)."""

    detail: str


# --------------------------------------------------------------------------- #
# Points (exchanged as lng/lat for convenience)
# --------------------------------------------------------------------------- #
class PointIn(Schema):
    name: str = Field(..., max_length=255)
    description: str = Field("", max_length=500)
    lng: float = Field(..., ge=-180, le=180, description="Longitude (WGS84)")
    lat: float = Field(..., ge=-90, le=90, description="Latitude (WGS84)")


class PointPatch(Schema):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    lat: Optional[float] = Field(None, ge=-90, le=90)


class PointOut(ModelSchema):
    lng: float
    lat: float

    class Meta:
        model = DemoPoint
        fields = ["id", "name", "description", "created_at"]

    @staticmethod
    def resolve_lng(obj) -> float:
        return obj.geom.x

    @staticmethod
    def resolve_lat(obj) -> float:
        return obj.geom.y


# --------------------------------------------------------------------------- #
# Polygons / Lines (exchanged as GeoJSON geometry objects)
# --------------------------------------------------------------------------- #
class PolygonIn(Schema):
    name: str = Field(..., max_length=255)
    description: str = Field("", max_length=500)
    geojson: GeoJSON = Field(..., description="GeoJSON Polygon geometry")


class LineIn(Schema):
    name: str = Field(..., max_length=255)
    description: str = Field("", max_length=500)
    geojson: GeoJSON = Field(..., description="GeoJSON LineString geometry")


class GeometryPatch(Schema):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    geojson: Optional[GeoJSON] = None


class PolygonOut(ModelSchema):
    geojson: GeoJSON

    class Meta:
        model = DemoPolygon
        fields = ["id", "name", "description", "created_at"]

    @staticmethod
    def resolve_geojson(obj) -> GeoJSON:
        return json.loads(obj.geom.geojson)


class LineOut(ModelSchema):
    geojson: GeoJSON

    class Meta:
        model = DemoLine
        fields = ["id", "name", "description", "created_at"]

    @staticmethod
    def resolve_geojson(obj) -> GeoJSON:
        return json.loads(obj.geom.geojson)


# --------------------------------------------------------------------------- #
# Analytical result schemas
# --------------------------------------------------------------------------- #
class PolygonAreaOut(Schema):
    id: int
    name: str
    area: float = Field(
        ..., description="Area in the layer's SRID units (square degrees for EPSG:4326)"
    )


class FeatureGeoJSONOut(Schema):
    """A feature reduced to id/name plus a derived geometry (centroid, simplified)."""

    id: int
    name: str
    geojson: GeoJSON


class NearestPointOut(Schema):
    id: int
    name: str
    distance_meters: float


class GeometryResultOut(Schema):
    """Result of a geometry operation; geojson is null when the result is empty."""

    geojson: Optional[GeoJSON] = None


# --------------------------------------------------------------------------- #
# GDAL result schemas
# --------------------------------------------------------------------------- #
class RasterStatsOut(Schema):
    min: float
    max: float
    mean: float
    stddev: float


class PixelValueOut(Schema):
    value: float


class RasterMetadataOut(Schema):
    driver: str
    size: list[int]
    bands: int
    projection: str
    geotransform: list[float]


class VectorField(Schema):
    name: str
    type: str


class VectorSchemaOut(Schema):
    fields: list[VectorField]


class ClipRasterOut(Schema):
    output_path: str


class UploadReprojectOut(Schema):
    features: list[GeoJSON]
