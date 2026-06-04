# WebGIS Template — Web Client (React + MapLibre)

The React web client for the WebGIS template. It renders an interactive
**MapLibre GL** map (via `react-map-gl/maplibre`) with a config-driven layer
system, a filterable attribute table and dashboard, and headless
[django-allauth] authentication against the Django backend.

This is one component of a single monorepo (see the repository root `README.md`
and `ARCHITECTURE.md`). The recommended way to run the whole stack is
`docker compose up --build` from the repo root.

## Tech stack

| Technology | Purpose |
| --- | --- |
| React 19 + Vite | App framework and build tooling (plain JavaScript, no TypeScript) |
| `react-map-gl/maplibre` + `maplibre-gl` | Map rendering |
| `pmtiles` + `protomaps-themes-base` | Optional PMTiles vector basemap |
| Material UI v7 + `@mui/x-data-grid` | UI components and the attribute table |
| Recharts | Dashboard charts |
| Zustand | State management (`src/store/`) |
| React Router v7 | Routing (`/`, email verify / password reset) |

## Run it

```bash
# from frontend/
npm install
npm run dev        # http://localhost:5173
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`. The backend
must be running (default `http://localhost:8000`) for auth and the backend-data
layer; the simplest way to run both is `docker compose up` from the repo root.

## Project structure

Components live in `Components/` (capital `C`), a **sibling of `src/`**, not
inside it. Imports cross that boundary (e.g. `src/App.jsx` imports
`../Components/Sidebar.jsx`).

```
frontend/
├── Components/            # Map, Sidebar, table, dashboard, auth forms (capital C)
│   ├── Mapview.jsx        # MapLibre map; renders every visible registry layer
│   ├── Sidebar.jsx        # search, layer toggles, config-driven filters
│   ├── CollapsableTable.jsx
│   └── Dashboard.jsx
├── src/
│   ├── main.jsx           # entry point
│   ├── App.jsx            # app shell / layout
│   ├── AppRoutes.jsx      # routes
│   ├── layers.js          # << the layer registry (see Customization)
│   ├── mapStyle.js        # basemap style builder (PMTiles or raster OSM)
│   └── store/
│       ├── useStore.js    # map/UI/data state + layer fetching & filtering
│       └── useAuthStore.js# auth, persisted to localStorage
├── constants/
├── public/
├── .env.example
└── index.html
```

## Environment variables

Only `VITE_`-prefixed vars are exposed to the client, and they are inlined at
**build** time. Copy `.env.example` to `.env` and adjust. Key vars:

- `VITE_API_URL` — base URL of the Django API (the allauth base is derived from it).
- `VITE_MUNI_GEOJSON_URL` — the attribute-rich overlay's GeoJSON source.
- `VITE_BASEMAP_PMTILES_URL` — optional PMTiles basemap; falls back to raster OSM when blank.

See `.env.example` for the full, commented list.

## Customization: add or swap a map layer

Layers are **data-driven from `src/layers.js`** — you do not edit the map,
table, sidebar, or dashboard components to add one. Each entry in `LAYER_CONFIGS`
describes a layer:

- `source`: either `{ kind: 'geojson-url', url }` (any external GeoJSON
  FeatureCollection) or `{ kind: 'backend', endpoint }` (this template's own API,
  fetched from `${VITE_API_URL}${endpoint}` and converted from the
  `{items:[{geojson,...}]}` payload to a FeatureCollection).
- `style`: line/fill colors and opacity used to draw it.
- `primary: true` on exactly one layer: that layer's `columns`,
  `categoricalFilters`, `rangeFilter`, `dashboard`, and `popup` field metadata
  drive the attribute table, sidebar filters, dashboard charts, and map popups.

The template ships two examples: the St. Louis municipalities overlay
(`geojson-url`, primary) and a `Demo Polygons (backend API)` layer
(`kind: 'backend'`, `GET /api/polygons`) that demonstrates consuming the
template's own backend (toggle it on in the sidebar; it shows whatever polygons
exist in the database). Add your own by appending a config object — no component
changes required.

## Backend integration

This client pairs with the Django backend in `../backend` (Django Ninja +
GeoDjango/PostGIS, django-allauth headless). Auth requests go to
`/_allauth/app/v1/auth/...` with an `X-Session-Token`; data requests go to
`${VITE_API_URL}/...`. The `Demo Polygons (backend API)` layer is the reference
pattern for reading geospatial data from the backend.

## License

MIT.

[django-allauth]: https://docs.allauth.org/
