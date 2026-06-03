# WebGIS

A forkable, full-stack **WebGIS template**: a Django/GeoDjango + PostGIS API, a React +
MapLibre GL JS (PMTiles) web client, and an Expo React Native mobile client, all in one
monorepo and ready to run in containers or deploy to DigitalOcean App Platform.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Django 5.2, Django Ninja, GeoDjango, PostGIS, django-allauth (headless), Celery (optional) |
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
  `FRONTEND_URL`, `ALLOWED_HOSTS`, `EMAIL_*`, optional `REDIS_URL`.
- `frontend/.env.example` — `VITE_API_URL`, `VITE_MUNI_GEOJSON_URL`, and the PMTiles vars
  (`VITE_BASEMAP_PMTILES_URL`, `VITE_GLYPHS_URL`). `VITE_*` are inlined at **build** time.

### Map basemap

The web map uses a **PMTiles vector basemap** when `VITE_BASEMAP_PMTILES_URL` points at a
`.pmtiles` archive (Protomaps schema), and falls back to **raster OpenStreetMap** when it is
blank, so the app works out of the box. In production, host the archive on DO Spaces and
configure the bucket CORS to allow `Range` requests from your origin.

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

## Development notes

- The web client is plain **JavaScript** (no TypeScript); lint with `npm run lint`.
- Backend tests: `cd backend && pytest`.
- Per-component detail lives in `backend/ReadMe.md`, `frontend/README.md`, `mobile/README.md`
  (their multi-repo setup sections predate this monorepo; this README is authoritative).

## License

MIT © [GeoBrad.dev](https://geobrad.dev)
