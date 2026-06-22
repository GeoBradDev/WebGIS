# WebGIS

A forkable, full-stack **WebGIS template**: a Django/GeoDjango + PostGIS API, a React +
MapLibre GL JS (PMTiles) web client, and an Expo React Native mobile client, all in one
monorepo and ready to run in containers or deploy to DigitalOcean App Platform.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Django 6.0, Django Ninja, GeoDjango, PostGIS, django-allauth (headless), Celery (optional) |
| Web | React 19, Vite, MapLibre GL JS, PMTiles, Material UI, Zustand, react-router 7 |
| Mobile | Expo 53, React Native, expo-router, react-native-maps, Zustand |
| Infra | Docker Compose (local), DigitalOcean App Platform + Managed Postgres + Spaces (prod) |

## Repository structure

```
WebGIS/
├── backend/            Django + Django Ninja + GeoDjango/PostGIS API
├── frontend/           React + Vite + MapLibre GL JS (PMTiles) web client
├── mobile/             Expo / React Native client (TypeScript)
├── docker-compose.yml  Local containerized stack
├── .do/app.yaml        DigitalOcean App Platform spec
├── ARCHITECTURE.md     System design reference
└── README.md
```

This is a single git repository. See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the full
design (components, request/auth flow, deployment topology, and key decisions).

## Quick start (Docker, recommended)

Requires Docker + Docker Compose.

```bash
# 1. Configure environment (templates are committed; .env files are gitignored)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Set a real SECRET_KEY in backend/.env, e.g.:
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"

# 3. Bring up db (PostGIS) + backend + frontend
docker compose up --build
```

- Web client: http://localhost:5173
- API + docs: http://localhost:8000/api/docs
- Admin: http://localhost:8000/admin/  (`docker compose exec backend python manage.py createsuperuser`)

The demo geometry models (point/polygon/line) are registered with GeoDjango's
`GISModelAdmin`, so the admin edit pages render an interactive map widget. To seed a few
sample polygons, run `docker compose exec backend python manage.py import_demo_features`
(a `LayerMapping` example that loads `backend/api/sample_data/demo_polygons.geojson`).

If host port 5432 is in use: `POSTGRES_HOST_PORT=5433 docker compose up --build`.
For async email via Celery: `docker compose --profile celery up`.

## Manual setup (without containers)

**Backend** (needs Python 3.12+, PostgreSQL + PostGIS, and system GDAL/GEOS/PROJ):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # set SECRET_KEY + POSTGRES_* (or DATABASE_URL)
python manage.py migrate
python manage.py runserver     # http://localhost:8000
```

**Web client** (Node 20+):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                    # http://localhost:5173
```

**Mobile client** (Node 20+, Expo):

```bash
cd mobile
npm install
npm start                      # Expo dev server; needs GOOGLE_MAPS_API_KEY in mobile/.env
```

## Configuration

All configuration is environment-driven. Copy each `.env.example` to `.env` and edit:

- `backend/.env.example` — `SECRET_KEY`, `DEBUG`, `DATABASE_URL` or `POSTGRES_*`,
  `FRONTEND_URL`, `ALLOWED_HOSTS`, `EMAIL_*`, optional `REDIS_URL`. Email is env-driven and
  defaults to Django's **console backend when `DEBUG=True`**, so signup/verification emails
  print to stdout in local dev with no SMTP credentials; set `EMAIL_BACKEND` + `EMAIL_*` for
  real delivery.
- `frontend/.env.example` — `VITE_API_URL`, `VITE_MUNI_GEOJSON_URL`, and the PMTiles vars
  (`VITE_BASEMAP_PMTILES_URL`, `VITE_GLYPHS_URL`). `VITE_*` are inlined at **build** time.

### Map basemap

The web map uses a **PMTiles vector basemap** when `VITE_BASEMAP_PMTILES_URL` points at a
`.pmtiles` archive (Protomaps schema), and falls back to **raster OpenStreetMap** when it is
blank, so the app works out of the box. In production, host the archive on DO Spaces and
configure the bucket CORS to allow `Range` requests from your origin.

## Google Sign-In (SSO)

Google login is wired across all three clients via django-allauth's headless token flow; it stays
inert until you provide OAuth client IDs. To enable it:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project and
   configure the **OAuth consent screen** (External; scopes `profile`, `email`; add test users while
   the app is unverified).
2. Create OAuth **client IDs** under *APIs & Services → Credentials*:
   - **Web application** — Authorized JavaScript origins: your web origins (e.g.
     `http://localhost:5173` and your production domain).
   - **iOS** — bundle ID `com.brad.stricherz.WebGISReactNative` (change per fork).
   - **Android** — package name `com.brad.stricherz.WebGISReactNative` + the signing key SHA-1.
3. Set the IDs in each `.env`:
   - `backend/.env`: `GOOGLE_OAUTH_CLIENT_ID_WEB` (+ `GOOGLE_OAUTH_SECRET_WEB`),
     `GOOGLE_OAUTH_CLIENT_ID_IOS`, `GOOGLE_OAUTH_CLIENT_ID_ANDROID`.
   - `frontend/.env`: `VITE_GOOGLE_CLIENT_ID` (the web client ID).
   - `mobile/.env`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB/_IOS/_ANDROID`.

The clients obtain a Google `id_token` and POST it to `/_allauth/app/v1/auth/provider/token`;
allauth verifies the JWT signature and audience, then auto-links to an existing account with the
same verified email. (The allauth Google provider requires `PyJWT` + `cryptography`, which are in
`backend/requirements.txt`.) See `docs/superpowers/specs/2026-06-04-google-sso-design.md` for the
rationale.

## Deployment (DigitalOcean App Platform)

`.do/app.yaml` defines all components against this one repo (a backend service, a frontend
static site, a managed Postgres database, and a pre-deploy migration job).

```bash
# set github.repo/branch in .do/app.yaml, then:
doctl apps spec validate .do/app.yaml
doctl apps create --spec .do/app.yaml
```

Set the `SECRET`-typed env values (`SECRET_KEY`, `EMAIL_*`) in the App Platform UI. PostGIS is
enabled automatically on first deploy by the `CreateExtension` migration. See
[ARCHITECTURE.md §7](ARCHITECTURE.md) for details.

## Data architecture

The web map composes three kinds of geospatial data; pick whichever fits a given layer:

- **PMTiles vector basemap** — the background map (Protomaps schema), served from a single
  `.pmtiles` archive over HTTP range requests. Falls back to raster OSM when unset.
- **Attribute-rich GeoJSON overlay** — small, filterable, attribute-heavy layers (the demo St.
  Louis municipalities layer) fetched as GeoJSON and filtered client-side.
- **This template's own backend API** — geospatial data served by the Django API
  (`/api/points|polygons|lines`) and rendered on the map.

Web layers are **config-driven from `frontend/src/layers.js`**: each entry declares its data
`source` (`geojson-url` or `backend`), `style`, and field metadata. Add or swap a layer by editing
that file — the map, attribute table, sidebar filters, and dashboard all read from it, so no
component changes are needed. The shipped `Demo Polygons (backend API)` layer is the reference
pattern for consuming the backend.

## Security note: GDAL endpoints

The backend's `/api/gdal/*` endpoints parse raster/vector files with GDAL/OGR. The GDAL version
installed by the Docker base distro (3.6.2) has known advisories fixed only in much newer releases.
File paths are confined to `GDAL_FILE_ROOT`, but treat any file these endpoints touch as **trusted**
input. To expose them to untrusted users, sandbox GDAL or disable the router (drop the
`add_router("/gdal", ...)` line in `backend/api/api.py`). See `backend/ReadMe.md`.

## Development notes

- The web client is plain **JavaScript** (no TypeScript); lint with `npm run lint`.
- Backend tests: `cd backend && pytest` (needs a PostGIS database; Django builds an isolated test DB).
- Per-component detail lives in `backend/ReadMe.md`, `frontend/README.md`, and `mobile/README.md`.

## License

MIT © [GeoBrad.dev](https://geobrad.dev)
