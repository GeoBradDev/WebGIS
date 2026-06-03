# Architecture

Reference for the WebGIS template: a forkable, full-stack geospatial starter made of a
Django/GeoDjango backend, a React + MapLibre web client, and an Expo React Native mobile
client, deployable in containers to DigitalOcean App Platform.

## 1. Monorepo layout

This is a **single git repository** (one `.git`, at the root) containing three deployable
projects plus shared infrastructure:

```
WebGIS/
├── backend/            Django + Django Ninja + GeoDjango/PostGIS API
├── frontend/           React 19 + Vite + MapLibre GL JS (PMTiles) web client
├── mobile/             Expo / React Native client (TypeScript)
├── docker-compose.yml  Local containerized stack (db + backend + frontend)
├── .do/app.yaml        DigitalOcean App Platform spec (all components, one repo)
├── .gitignore          Root ignores (each subproject also has its own)
├── README.md           Project entry point / quickstart
├── ARCHITECTURE.md     This document
└── CLAUDE.md           Guidance for the Claude Code agent
```

**Why a monorepo.** The three parts are developed and deployed together and share
cross-cutting infra (`docker-compose.yml`, `.do/app.yaml`) that has no natural home in any
single sub-project. One repo gives atomic cross-cutting changes, one clone for forkers, and
one place for the deploy spec. App Platform still builds each component independently, scoped
by `source_dir` / `dockerfile_path` within the one repo.

**Provenance.** This was consolidated from three previously separate repositories
(`GeoBradDev/WebGIS-Django`, `GeoBradDev/WebGIS-React`, `GeoBradDev/WebGIS-React-Native`).
Their independent histories were dropped in the merge; the working trees were preserved.

## 2. Components

| Component | Stack | Role |
|-----------|-------|------|
| `backend/` | Django 5.2, Django Ninja, GeoDjango, PostGIS, django-allauth (headless), Celery (optional) | REST API, auth, spatial data |
| `frontend/` | React 19, Vite, MapLibre GL JS, PMTiles, MUI, Zustand, react-router 7 | Web map UI (plain JS, no TS) |
| `mobile/` | Expo 53, React Native, expo-router, react-native-maps, Zustand | Mobile client (TypeScript) |

The two clients are **alternative frontends** for the same backend; there is no shared build
or package linkage between the three. Each has its own dependencies and tooling.

## 3. Runtime topology & request flow

```
                         ┌──────────────────────────────────────────┐
   Browser (frontend)    │            DigitalOcean App Platform      │
   ┌───────────────┐     │  ┌───────────────┐     ┌───────────────┐  │
   │ React +       │ ───────▶│ static_site   │     │ backend (web) │  │
   │ MapLibre GL   │     │  │ (CDN, Vite dist)│   ┌▶│ gunicorn+     │  │
   └──────┬────────┘     │  └───────────────┘   │ │ uvicorn (ASGI)│  │
          │  /api, /_allauth (X-Session-Token)  │ └──────┬────────┘  │
          ├──────────────────────────────────────┘        │           │
          │                                    routes:     ▼           │
          │  pmtiles:// (HTTP Range)          /api /_allauth      ┌──────────┐
          ▼                                    /admin /static     │ Managed  │
   ┌───────────────┐                                              │ Postgres │
   │ DO Spaces      │                          PRE_DEPLOY job ───▶│ + PostGIS│
   │ basemap.pmtiles│                          (migrate)          └──────────┘
   └───────────────┘
```

- **Ingress routing** (App Platform, longest-prefix match): `/api`, `/_allauth`, `/admin`,
  `/static` → backend service; everything else (`/`) → frontend static site, which serves
  `index.html` as the SPA fallback for client-side routes (`/verify-email/:key`,
  `/reset-password/...`).
- **Auth** is django-allauth **headless**: the frontend calls `/_allauth/app/v1/auth/...`
  and carries an `X-Session-Token` (no cookies/CSRF on the API; `NinjaAPI(csrf=False)`).
  Email verification links are built from `FRONTEND_URL`.
- **Map data** is split: the attribute-rich municipalities overlay is **GeoJSON** fetched
  from `VITE_MUNI_GEOJSON_URL` and filtered client-side; the **basemap** is a PMTiles vector
  archive (Protomaps schema) loaded by MapLibre via the `pmtiles://` protocol over HTTP Range
  requests from DO Spaces. See §5.

## 4. Backend internals (`backend/`)

- **Single-file API.** All endpoints live in `api/api.py` as one `NinjaAPI` instance, grouped
  by OpenAPI tags (Polygons, Points, Lines, Spatial Join, Nearest Neighbor, Geometry
  Operations, GDAL). `WebGIS/urls.py` mounts it at `/api/` and adds a DB-free `/healthz`.
- **Geospatial.** Models (`api/models.py`) use GeoDjango fields (`srid=4326`); endpoints use
  PostGIS spatial lookups and GIS DB functions, plus direct `osgeo` (GDAL/OGR) calls for the
  raster/vector endpoints. Note: `GET /api/polygons` returns bare geometry with no attributes,
  so it is not a drop-in replacement for the attribute-rich web overlay.
- **PostGIS bootstrap.** Migration `api/0002` runs `CreateExtension('postgis')` before any
  geometry column, so a fresh DB (DO Managed Postgres, where PostGIS is available but not
  enabled) migrates cleanly.
- **Custom user.** `api.CustomUser` authenticates by **email** (lowercased), via a custom
  manager doing case-insensitive lookup.
- **Async email.** `AsyncAccountAdapter` dispatches allauth emails through a Celery task
  (`send_email_async`). Celery activates only when `REDIS_URL` is set; otherwise tasks run
  eagerly inline.
- **Config is env-driven** (`WebGIS/settings.py`; helpers `env_bool`/`env_list`). Prod prefers
  a single `DATABASE_URL` (via `dj-database-url`, engine forced back to PostGIS), falling back
  to discrete `POSTGRES_*` locally. Security is `DEBUG`-gated: with `DEBUG=False`, CORS is
  restricted to `FRONTEND_URL`, the `SECURE_*`/proxy-SSL/HSTS settings turn on (App Platform
  terminates TLS via `X-Forwarded-Proto`), and logs go to stdout. Full var list in
  `backend/.env.example`.

## 5. Frontend internals (`frontend/`)

- **Map: MapLibre GL JS via `react-map-gl/maplibre`.** `Components/Mapview.jsx` registers the
  `pmtiles://` protocol once at module scope, renders `<Map>` with `<Source>/<Layer>` children,
  handles popups via `interactiveLayerIds` + click, and converts the store's Leaflet-style
  `[lat, lng]` to maplibre `[lng, lat]` only at the map boundary.
- **Style builder.** `src/mapStyle.js` assembles the style from env: a PMTiles vector basemap
  (Protomaps schema via `protomaps-themes-base`) when `VITE_BASEMAP_PMTILES_URL` is set,
  otherwise raster OpenStreetMap so the map works out of the box. A `BASEMAPS` registry drives
  the in-map basemap switcher (`activeBasemap` in the store).
- **State.** Two Zustand stores: `src/store/useStore.js` (map/UI/GeoJSON + filtering) and
  `src/store/useAuthStore.js` (auth, persisted to `localStorage`; allauth base derived from
  `VITE_API_URL`).
- **Build-time config.** `VITE_*` vars are inlined at build time (see `frontend/.env.example`);
  Vite `base` is `/` (root-served on App Platform).
- **Layout quirk:** components live in `frontend/Components/` (capital C), a sibling of `src/`,
  not inside it — imports cross that boundary.

## 6. Mobile internals (`mobile/`)

- **expo-router** file-based routing; the map screen renders `components/MapViewWrapper.tsx`
  (currently `react-native-maps`). Thin Zustand stores in `store/`.
- TypeScript (unlike the JS web client). **PMTiles is deferred** on mobile (would need
  `@maplibre/maplibre-react-native` + an Expo dev build). Mobile is **not** deployed by App
  Platform; it ships via EAS / the app stores.

## 7. Deployment

- **Local containers** — `docker-compose.yml`: `db` (`postgis/postgis:16-3.4`, healthcheck),
  `backend` (built image, migrates on boot via `entrypoint.sh`, gated by `RUN_MIGRATIONS`),
  `frontend` (Vite dev server), optional `redis`/`celery` profile. `POSTGRES_HOST_PORT`
  overrides the published DB port if 5432 is taken.
- **Backend image** — `backend/Dockerfile`, multi-stage on `python:3.12-slim-bookworm`. GDAL is
  installed from the distro and the Python binding is pinned to `gdal-config --version`
  (container runs GDAL 3.6.2). `requirements.txt` keeps its own `GDAL==3.4.1` pin for the
  maintainer's host install, which the Dockerfile strips. collectstatic runs at build
  (whitenoise manifest storage); runs as non-root `appuser`; gunicorn + uvicorn worker.
- **DO App Platform** — `.do/app.yaml`: a `backend` service, a `frontend` static site, a
  managed `db`, and a `PRE_DEPLOY` `migrate` job (so web replicas never race migrations). All
  components point at the **same monorepo**, scoped by `source_dir`/`dockerfile_path`.
  `${db.DATABASE_URL}` and `${APP_DOMAIN}` are App Platform bindable vars; `SECRET_KEY`/`EMAIL_*`
  are `type: SECRET`. Validate with `doctl apps spec validate .do/app.yaml`.
- **PMTiles hosting** — production tiles live in **DO Spaces**. The bucket CORS must allow the
  frontend origin with `GET`/`HEAD` + the `Range` header and expose
  `Content-Range`/`Accept-Ranges`, or the browser blocks the range requests and the basemap is
  blank.
- **CI** — root `.github/workflows/` holds two path-filtered workflows: `frontend-ci.yml`
  (`npm ci` + lint + build, scoped to `frontend/**`) and `backend-ci.yml` (builds the backend
  Docker image, then runs `manage.py check`, a `makemigrations --check` drift gate, and pytest
  inside it, scoped to `backend/**`). Running backend checks in the image avoids the
  GDAL-on-a-bare-runner problem. Path filters keep a frontend PR from triggering backend CI and
  vice versa.

## 8. Key decisions & trade-offs

- **GDAL version floats to the container distro (3.6.2), not the `3.4.1` pin.** A stock base
  image can't provide both GDAL 3.4.1 and a Python new enough for Django 5.2 + numpy 2.3
  (Ubuntu 22.04 has GDAL 3.4.1 but Python 3.10; the osgeo GDAL 3.4.1 image is Python 3.8). The
  Dockerfile installs the distro GDAL and pins the binding to it, keeping host and container
  independently buildable.
- **Split map data model.** Vector tiles (PMTiles) are great for basemaps but the interactive,
  filterable, attribute-rich municipalities layer is small and is better served as GeoJSON with
  client-side filtering. The two coexist.
- **Raster fallback.** When no PMTiles URL is configured the map falls back to raster OSM, so a
  fresh fork renders a working map with zero tile data to host.
- **Migrations run in a PRE_DEPLOY job in prod**, on boot only in local compose — avoids
  multi-replica races while keeping local dev one-command.

## 9. Known issues / follow-ups

- **Subproject READMEs predate the monorepo.** `backend/ReadMe.md`, `frontend/README.md`, and
  `mobile/README.md` still describe cloning three separate repos and running a multi-repo
  bootstrap. The root `README.md` is now authoritative; the subproject READMEs are kept for
  per-component detail but their setup sections are superseded.
- **Unused backend deps.** `numpy`, `nltk`, `pillow`, `terminaltables`, `pip-check`,
  `pip-review` are in `requirements.txt` but not imported by the app — candidates for cleanup.
- **GDAL CVEs.** The container's GDAL 3.6.2 carries 3 advisories fixed only in GDAL 3.13, which
  no current Linux distro ships via apt. Lock down or disable the `/api/gdal/*` endpoints if
  they process untrusted input until a 3.13 base is viable.
