# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# WebGIS Django backend image.
#
# GDAL is the tricky dependency: the Python `GDAL` binding must match the system
# libgdal version exactly. Rather than pin a base image to a single GDAL release
# (the osgeo/gdal:3.4.1 image is Ubuntu 20.04 / Python 3.8, too old for Django
# 5.2 + numpy 2.3), we use a modern Python base and install whatever GDAL the
# distro ships, then pip-install the matching binding via `gdal-config --version`.
# requirements.txt keeps its own GDAL pin for host/local installs; we strip it
# here so the container's GDAL always matches its own libgdal.
# ─────────────────────────────────────────────────────────────────────────────

ARG PYTHON_VERSION=3.14

# ---------- Stage 1: builder ----------
FROM python:${PYTHON_VERSION}-slim-bookworm AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Toolchain + GDAL/GEOS/PROJ dev headers needed to build the GDAL binding.
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app
COPY requirements.txt .
# Install everything except GDAL, then install the GDAL binding pinned to the
# system libgdal (numpy is already installed first so gdal_array builds too).
RUN pip install --upgrade pip \
    && grep -ivE '^GDAL==' requirements.txt > /tmp/requirements.nogdal.txt \
    && pip install -r /tmp/requirements.nogdal.txt \
    && pip install "GDAL==$(gdal-config --version)"

# ---------- Stage 2: runtime ----------
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=WebGIS.settings \
    PORT=8080

# Runtime shared libraries only (no toolchain). gdal-bin pulls libgdal; the
# geos/proj runtime libs are what GeoDjango dlopens at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gdal-bin \
        libgeos-c1v5 \
        proj-bin \
    && rm -rf /var/lib/apt/lists/*

# Bring the built virtualenv (incl. the compiled GDAL binding) from the builder.
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
COPY . .

# Collect static assets at build time so whitenoise can serve hashed files.
# A throwaway SECRET_KEY is enough; settings import must not touch the DB.
RUN SECRET_KEY=build-only DEBUG=False python manage.py collectstatic --no-input

# Run as a non-root user and give it ownership of writable paths.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
CMD gunicorn WebGIS.asgi:application -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT:-8080} --workers 2
