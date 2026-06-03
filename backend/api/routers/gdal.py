"""GDAL/OGR raster and vector utilities.

File-path parameters are confined to ``settings.GDAL_FILE_ROOT`` (see
``services._safe_path``); failures return proper 4xx responses rather than a
200 with an ``{"error": ...}`` body.
"""

from ninja import Router, UploadedFile

from .. import services
from ..schemas import (
    ClipRasterOut,
    PixelValueOut,
    RasterMetadataOut,
    RasterStatsOut,
    UploadReprojectOut,
    VectorSchemaOut,
)

router = Router()


@router.get("/raster-stats", response=RasterStatsOut, tags=["GDAL"])
def raster_stats(request, raster_path: str):
    """Min, max, mean, and stddev for a raster's first band."""
    return services.raster_stats(raster_path)


@router.get("/pixel-value", response=PixelValueOut, tags=["GDAL"])
def pixel_value(request, raster_path: str, lng: float, lat: float):
    """Raster pixel value at a lon/lat location."""
    return services.pixel_value(raster_path, lng, lat)


@router.get("/clip-raster", response=ClipRasterOut, tags=["GDAL"])
def clip_raster(
    request, raster_path: str, out_path: str, minx: float, miny: float, maxx: float, maxy: float
):
    """Clip a raster to a bounding box and write it to disk."""
    return services.clip_raster(raster_path, out_path, minx, miny, maxx, maxy)


@router.get("/vector-schema", response=VectorSchemaOut, tags=["GDAL"])
def vector_schema(request, vector_path: str):
    """Field names and types from a vector dataset."""
    return services.vector_schema(vector_path)


@router.get("/raster-metadata", response=RasterMetadataOut, tags=["GDAL"])
def raster_metadata(request, raster_path: str):
    """Driver, size, band count, projection, and geotransform of a raster."""
    return services.raster_metadata(raster_path)


@router.post("/upload-reproject", response=UploadReprojectOut, tags=["GDAL"])
def upload_and_reproject(request, file: UploadedFile):
    """Upload a vector file and reproject its features to EPSG:4326 (GeoJSON)."""
    return services.upload_and_reproject(file)
