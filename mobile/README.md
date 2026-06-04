# WebGIS Template — Mobile Client (Expo / React Native)

The Expo / React Native mobile client for the WebGIS template. It renders an
interactive map with `react-native-maps` (OpenStreetMap) and is one component of
a single monorepo (see the repository root `README.md` and `ARCHITECTURE.md`).

Unlike the web client (`frontend/`, plain JavaScript), this client is
**TypeScript** and uses **expo-router** file-based routing.

## Tech stack

| Technology | Purpose |
| --- | --- |
| Expo + React Native | Mobile framework |
| expo-router | File-based routing (`app/`) |
| `react-native-maps` | Map rendering (OpenStreetMap) |
| Zustand | State management (`store/`) |
| TypeScript | Language |

## Run it

```bash
# from mobile/
npm install
npm start            # Expo dev server (or: npm run android / ios / web)
npm test             # jest-expo
npm run type-check   # tsc --noEmit
```

Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. On a **physical
device** this must be your dev machine's LAN IP (e.g. `http://192.168.1.50:8000/api`),
not `localhost`. Also set `GOOGLE_MAPS_API_KEY` (consumed by `app.config.js`).

Run the app on a device with **Expo Go** or in an emulator. The mobile client is
**not** deployed to App Platform; it ships via EAS / the app stores.

The client has feature parity with the web client: config-driven layers, location
search, layer toggles, attribute filters, a feature list, a dashboard, and
login/signup auth. The PMTiles vector basemap remains the documented roadmap gap
(mobile uses OSM raster tiles via `react-native-maps`).

## Project structure

This client uses **expo-router**, so screens are files under `app/` (there is no
`screens/` folder or `App.tsx`; the entry is `expo-router/entry`, set as
`main` in `package.json`).

```
mobile/
├── app/                  # expo-router routes
│   ├── _layout.tsx       # root layout
│   ├── (tabs)/
│   │   ├── _layout.tsx   # tab navigator
│   │   ├── index.tsx     # map screen (renders components/MapViewWrapper)
│   │   └── two.tsx
│   ├── modal.tsx
│   └── +not-found.tsx
├── components/
│   └── MapViewWrapper.tsx # wraps react-native-maps
├── store/
│   ├── useMapStore.ts    # map region
│   └── useAppStore.ts    # loading flag + sessionToken
├── hooks/
│   └── useLocation.ts
├── constants/
├── assets/
├── app.config.js         # Expo config (reads GOOGLE_MAPS_API_KEY)
└── package.json
```

## Backend integration

This client pairs with the Django backend in `../backend` (Django Ninja +
GeoDjango/PostGIS, django-allauth headless). `store/useAppStore.ts` holds a
`sessionToken` for authenticated requests against `${API}/_allauth/...`.

## Roadmap: PMTiles / MapLibre parity with the web client

The web client renders **PMTiles vector basemaps** via MapLibre GL JS. This
client still uses `react-native-maps` and does **not** support PMTiles yet. To
reach parity:

1. Replace `react-native-maps` with
   [`@maplibre/maplibre-react-native`](https://github.com/maplibre/maplibre-react-native),
   which supports MapLibre styles and the `pmtiles://` protocol.
2. Switch to an **Expo dev build** (`expo-dev-client` is already a dependency),
   since MapLibre Native is a custom native module not available in Expo Go.
3. Point the basemap at the same PMTiles archive the web client uses (DO Spaces)
   and reuse the Protomaps basemap style.

This is intentionally deferred: it requires native modules and a dev build, and
mobile is not part of the containerized App Platform deployment.

## License

MIT.
