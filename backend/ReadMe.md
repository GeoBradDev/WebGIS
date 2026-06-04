# WebGIS Template — Backend (Django + Django Ninja + PostGIS)

The Django REST API for the WebGIS template: a type-safe Django Ninja API over
GeoDjango/PostGIS, with headless django-allauth authentication and optional
Celery. It is one component of a single monorepo (see the repository root
`README.md` and `ARCHITECTURE.md`); the recommended way to run everything is
`docker compose up --build` from the repo root.

## Tech stack

- **Django 5.2** + **Django Ninja** (Pydantic-based, type-safe API; no DRF)
- **GeoDjango + PostGIS** for spatial models and queries
- **django-allauth (headless)** — email-based auth via `/_allauth/app/v1/...`
- **GDAL/OGR** for raster/vector utilities
- **Celery** (optional; enabled when `REDIS_URL` is set, otherwise tasks run eagerly)
- **gunicorn + uvicorn worker** in production, **whitenoise** for static files

## Run it

With containers (recommended), from the repo root: `docker compose up --build`.

Without containers (needs Python 3.12+, PostgreSQL + PostGIS, and system
GDAL/GEOS/PROJ):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set SECRET_KEY + POSTGRES_* (or DATABASE_URL)
python manage.py migrate
python manage.py runserver    # http://localhost:8000
```

`scripts/bootstrap.sh` automates a host (non-container) Postgres/PostGIS + venv
setup; its credentials are environment-overridable (see the script header).

## API layout

- API root: `/api` (interactive docs at `/api/docs`), admin at `/admin`,
  allauth headless at `/_allauth/`, DB-free health check at `/healthz`.
- Routers live in `api/routers/`:
  - `features.py` — Point / Polygon / Line CRUD + simple queries (`/api/points`, `/api/polygons`, `/api/lines`)
  - `spatial.py` — spatial joins, nearest-neighbor, intersection/difference/union/buffer (`/api/spatial/...`)
  - `gdal.py` — GDAL/OGR raster + vector utilities (`/api/gdal/...`)
- Thin views call `api/services.py` (ORM + GEOS/GDAL logic); request/response
  shapes are in `api/schemas.py`. Geometries are exchanged as real **GeoJSON
  objects**. A bad geometry raises `services.InvalidGeometry` → HTTP 422.
- To add an endpoint: route in the relevant `routers/*.py` → logic in
  `services.py` → schemas in `schemas.py`. The demo models (`api/models.py`)
  carry a `name`, `description`, `geom`, and `created_at` to show how to extend a
  GeoDjango model (add a field → `makemigrations`/`migrate` → expose in schemas).

## Security note: GDAL endpoints

The `/api/gdal/*` endpoints parse raster/vector files with GDAL/OGR. The GDAL
version installed by the Docker base distro (3.6.2) has known advisories fixed
only in much newer GDAL releases. File paths are confined to
`settings.GDAL_FILE_ROOT`, but you should still treat any file these endpoints
touch as **trusted** input. If you expose them to untrusted users, sandbox GDAL
or disable the router (drop the `add_router("/gdal", ...)` line in `api/api.py`).

## Tests

```bash
pytest
```

Requires a PostGIS-capable database (the same one the app uses); Django builds an
isolated `test_<db>` from it. `api/tests.py` covers the feature CRUD, spatial
queries, geometry validation, and the GDAL path guard.

## Project structure

```
backend/
├── api/
│   ├── models.py          # GeoDjango models + CustomUser (email login)
│   ├── services.py        # ORM + GEOS/GDAL logic (InvalidGeometry, _safe_path)
│   ├── schemas.py         # Ninja In/Out/Patch schemas
│   ├── api.py             # NinjaAPI root; mounts routers
│   ├── routers/           # features.py, spatial.py, gdal.py
│   ├── adapters.py        # async allauth email adapter
│   ├── tasks.py           # Celery tasks
│   └── migrations/
├── WebGIS/                # settings.py, urls.py, asgi.py, wsgi.py, celery.py
├── scripts/bootstrap.sh   # host (non-container) setup helper
├── Dockerfile, entrypoint.sh
├── requirements.txt, pytest.ini
└── manage.py
```

## License

MIT.
