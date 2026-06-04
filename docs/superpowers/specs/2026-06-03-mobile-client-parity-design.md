# Mobile client parity with the web client — design

## Context

The WebGIS monorepo has three deployable clients: a Django backend, a React web client, and an
Expo/React Native mobile client. A review found the **mobile client is a scaffold** — the default
expo-router tabs starter with a near-empty `react-native-maps` view (an unused `UrlTile` import,
so no tiles actually render), the default "Tab Two", stub Zustand stores, and **no API client,
auth, GeoJSON rendering, search, filters, or dashboard.** The web client, by contrast, has a
config-driven layer system, location search, layer toggles, attribute filters, an attribute table,
a Recharts dashboard, and full django-allauth authentication.

This project builds the mobile client out to **feature parity** with the web client, translated to
Expo/RN idioms. The structure deliberately parallels the web client so a maintainer can move
between them; no code is shared (separate packages, JS vs TS — the monorepo intentionally has no
build linkage between clients).

## Decisions (locked with the user)

- **Map foundation:** keep **`react-native-maps`** (already integrated, Google Maps provider via
  the configured API key). Render an OSM raster basemap via `<UrlTile>` and the data layers via
  `<Geojson>`. The **PMTiles vector basemap is out of scope** — it stays a documented roadmap item
  (would require swapping to `@maplibre/maplibre-react-native`). This is the one deliberate gap vs
  web.
- **Scope:** **full parity** — map + config-driven layers, location search, layer toggles,
  attribute filters, attribute list (table equivalent), dashboard charts, and auth.
- **Auth depth:** **login + signup** against allauth headless. Signup triggers the verification
  email (the link points at the web app, where the user verifies); the user then logs in on mobile.
  Session token persisted on-device.

## Architecture

The mobile app mirrors the web client's config-driven, store-backed shape.

### Navigation (3 tabs, replacing the scaffold)

- **Map** — `app/(tabs)/index.tsx` — main screen (map + overlays + controls).
- **Dashboard** — `app/(tabs)/dashboard.tsx` (replaces the scaffold `two.tsx`) — charts.
- **Account** — `app/(tabs)/account.tsx` — login/signup/profile.

`app/(tabs)/_layout.tsx` gets real titles/icons for these three. The scaffold `EditScreenInfo`
content and `two.tsx` are removed.

### Config-driven layer registry

`mobile/config/layers.ts` — a TypeScript mirror of web `src/layers.js`. `LAYER_CONFIGS` entries:
`id`, `name`, `primary?`, `visible`, `source` (`{kind:'geojson-url', url}` or
`{kind:'backend', endpoint}`), `style` (line/fill color, width, opacity), `popup`
(`titleField` + labelled `rows`), `columns`, `categoricalFilters`, `rangeFilter`, `dashboard`
(`categoryField`/`valueField`/`valueLabel`). `PRIMARY_LAYER` is the entry with `primary: true`.
Ships the same two examples: St. Louis municipalities (`geojson-url`, primary) and `Demo Polygons
(backend API)` (`kind:'backend'`, `/polygons`).

### Stores (Zustand — building out the existing stubs)

- `store/useLayerStore.ts` — RN twin of web `useStore`: `layers` registry built from
  `LAYER_CONFIGS`, `fetchLayers` (loads each layer; for `backend` source, fetches
  `${API_URL}${endpoint}` and converts the `{items:[{geojson, ...props}]}` payload to a
  FeatureCollection; attaches `X-Session-Token` when signed in), `toggleLayerVisibility`,
  filter state (`categorical` keyed by field, `rangeMin`/`rangeMax`), `setCategoricalFilter`,
  `setRange`, `resetFilters`, `getFilteredPrimaryData`, `getUniqueValues`.
- `store/useAuthStore.ts` — RN twin of web `useAuthStore`: `login`, `signup`, `logout`, `fetchUser`,
  `user`, `isAuthenticated`, `sessionToken`. Hits `${API_ORIGIN}/_allauth/app/v1/auth/...`. The
  session token is persisted with **`expo-secure-store`** (via a small custom storage adapter for
  Zustand `persist`).
- `store/useMapStore.ts` — kept for map region state.

### API configuration

`config/api.ts` resolves the API base from `process.env.EXPO_PUBLIC_API_URL` (Expo build-time env),
falling back to a sensible local default. The allauth origin is derived from it (strip `/api`), as
on web. Documented caveat: a **physical device must use the dev machine's LAN IP**, not `localhost`.
`.env.example` (or README) documents `EXPO_PUBLIC_API_URL` and the existing `GOOGLE_MAPS_API_KEY`.

## Screens & components

### Map screen (`app/(tabs)/index.tsx` + `components/`)

- `react-native-maps` `<MapView>` with `<UrlTile>` OSM raster basemap (replaces the empty map).
- One `<Geojson>` per visible layer, styled from config. Tapping a feature opens a
  **feature-detail panel** (a bottom card / `Modal`) rendered from that layer's `popup` config —
  the mobile popup equivalent. (`<Geojson onPress>` provides the pressed feature; if a styling/tap
  edge case appears on a geometry type, fall back to a tap-to-query against the rendered
  FeatureCollection.)
- **Search** bar: Nominatim forward geocode → `animateToRegion` (mirrors web sidebar search).
- **Home** and **GPS** buttons (reuse `hooks/useLocation.ts`).
- A collapsible **controls panel** (layer-visibility toggles from the registry + a "Filters"
  button) and a **feature-list** sheet ("Show List" — the attribute-table equivalent), both as RN
  `Modal`/absolute-positioned panels (no heavy bottom-sheet dependency), echoing the web's
  collapsible sidebar/table.

### Filters (`components/FiltersModal.tsx`)

A `Modal` generated from `PRIMARY_LAYER.categoricalFilters` (multi-select chips backed by
`getUniqueValues`) + `rangeFilter` (min/max numeric inputs). Drives `getFilteredPrimaryData`, which
feeds both the map's primary layer and the feature list. Multi-select uses plain `Pressable` chips
(no extra dependency).

### Attribute list (`components/FeatureList.tsx`)

A `FlatList` over the filtered primary-layer features, showing the columns from
`PRIMARY_LAYER.columns`. Opened from the Map screen's "Show List" control.

### Dashboard (`app/(tabs)/dashboard.tsx`)

`react-native-chart-kit` (+ `react-native-svg`): a bar chart and a pie chart over the primary
layer, using `PRIMARY_LAYER.dashboard` field metadata — the Recharts equivalent.

### Account (`app/(tabs)/account.tsx` + `components/AuthForm.tsx`)

Login + signup forms against `/_allauth/app/v1/auth/...`. On login success, store the session token
in SecureStore and mark authenticated. When authenticated, show profile info + a sign-out button.
Signup returns the "verification pending" state and surfaces a message (verification completed on
the web client).

## New dependencies

- `expo-secure-store` — session-token persistence.
- `react-native-chart-kit` + `react-native-svg` — dashboard charts.
- Remove the unused `expo-maps` dependency.

## Error handling

- `fetchLayers` uses `Promise.allSettled`; one failing layer does not block the others (logged).
- Auth and search failures surface user-facing messages (RN `Alert` or inline error text).
- Backend layer fetch tolerates the public endpoints being empty (renders nothing, no crash).
- Missing `EXPO_PUBLIC_API_URL` falls back to the documented local default.

## Testing & verification

- **Automated** (`jest-expo`, already configured): unit tests for the layer registry (config shape
  / `PRIMARY_LAYER` resolution) and the backend `{items}` → FeatureCollection transform (the main
  piece of real logic, mirroring what is unit-tested on web). Type-check with `tsc --noEmit` (this
  client is TypeScript).
- **Manual**: run against the local backend (`docker compose up`); verify OSM tiles + both layers
  render, tap → feature detail, search recenters the map, filters narrow the map + list, the
  dashboard charts draw, and login/signup round-trip and persist across app restart.

## Implementation phasing (for the plan)

1. **Foundation** — `config/layers.ts`, `config/api.ts`, `useLayerStore`, `useAuthStore`, 3-tab nav.
2. **Map screen** — `<MapView>` + OSM `<UrlTile>` + `<Geojson>` overlays + tap → feature detail +
   search + GPS/home.
3. **Controls** — layer toggles, filters modal, feature-list sheet.
4. **Dashboard + Account** — charts; auth screens + SecureStore persistence.

## Out of scope

- PMTiles vector basemap / MapLibre swap (documented roadmap; OSM raster used instead).
- Offline tile caching, background location, push notifications.
- Deep-link handling of the email-verification link into the app (verification happens on web).
- Any change to the backend or web client.

## Note on process

Per the user's git policy, this spec is written but **not committed** (the brainstorming default to
commit is overridden). Implementation will follow an approved plan.
