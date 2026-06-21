"""Root NinjaAPI instance.

Endpoints are organized into per-domain routers (see ``api/routers/``); this
module only assembles them and registers cross-cutting exception handlers.
"""

from ninja import NinjaAPI

from .routers.features import router as features_router
from .routers.gdal import router as gdal_router
from .routers.spatial import router as spatial_router
from .services import InvalidGeometry

api = NinjaAPI(
    title="Django WebGIS API Template",
    version="0.3.0",
    description="""
A boilerplate WebGIS API demonstrating common geospatial capabilities using GeoDjango and PostGIS.

This template provides a starting point for building full-featured WebGIS applications with a
type-safe, RESTful API.

Included examples:

- Point / Polygon / Line CRUD (GeoJSON in & out)
- Bounding box filtering and radius (near) queries
- Area, centroid, and geometry simplification
- Spatial joins (points within polygons) and nearest-neighbor search
- Geometric intersection, difference, union, and buffering
- GDAL/OGR raster and vector utilities

Built with Django, Django Ninja, GeoDjango, and PostGIS.
""",
)


@api.exception_handler(InvalidGeometry)
def on_invalid_geometry(request, exc):
    """Turn an unparseable client geometry into a clean 422."""
    return api.create_response(
        request, {"detail": f"Invalid GeoJSON geometry: {exc}"}, status=422
    )


# Core feature CRUD/queries mount at the root (/api/points, /api/polygons, ...).
api.add_router("", features_router)
# Analytical endpoints get their own namespaces.
api.add_router("/spatial", spatial_router)
api.add_router("/gdal", gdal_router)
