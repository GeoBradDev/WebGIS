# Mobile Client Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **GIT POLICY (user override):** Do NOT run `git commit` or `git push`. Where this plan says "Checkpoint", run the listed type-check/tests and pause for the user to review; the user commits manually. Never create commits.

**Goal:** Build the Expo/React Native mobile client out to feature parity with the web client — config-driven map layers, location search, layer toggles, attribute filters, a feature list, a dashboard, and login/signup auth.

**Architecture:** Mirror the web client's config-driven, Zustand-backed structure in TypeScript/RN. A `config/layers.ts` registry drives the map, list, filters, and dashboard (the RN twin of web `src/layers.js`). Pure logic (the backend→FeatureCollection transform, filtering) lives in `lib/` for unit testing; stores compose it; screens render it. Map rendering uses `react-native-maps` (`<UrlTile>` OSM basemap + `<Geojson>` overlays). Auth uses django-allauth headless with the session token in `expo-secure-store`.

**Tech Stack:** Expo SDK 53, expo-router v5, React Native 0.79 (TypeScript), Zustand, react-native-maps, react-native-chart-kit + react-native-svg, expo-secure-store, jest-expo.

---

## File structure

Create:
- `mobile/config/api.ts` — API base URL + allauth origin (from `EXPO_PUBLIC_API_URL`).
- `mobile/config/layers.ts` — `LAYER_CONFIGS`, `PRIMARY_LAYER`, types, `formatPopupValue`.
- `mobile/lib/geojson.ts` — `FeatureCollection`/`Feature` types + `backendItemsToFeatureCollection`.
- `mobile/lib/filters.ts` — pure `filterFeatures` + `uniqueValues`.
- `mobile/lib/__tests__/geojson.test.ts`, `mobile/lib/__tests__/filters.test.ts`, `mobile/config/__tests__/layers.test.ts`.
- `mobile/store/secureStorage.ts` — Zustand persist storage over expo-secure-store.
- `mobile/store/useAuthStore.ts` — auth (login/signup/logout/fetchUser).
- `mobile/store/useLayerStore.ts` — layer registry + filtering selectors.
- `mobile/components/SearchBar.tsx`, `FeatureDetail.tsx`, `LayerControls.tsx`, `FiltersModal.tsx`, `FeatureList.tsx`, `AuthForm.tsx`.
- `mobile/app/(tabs)/dashboard.tsx`, `mobile/app/(tabs)/account.tsx`.
- `mobile/.env.example`.

Modify:
- `mobile/components/MapViewWrapper.tsx` — full rewrite (map + tiles + overlays + controls).
- `mobile/app/(tabs)/index.tsx` — compose Map screen.
- `mobile/app/(tabs)/_layout.tsx` — 3 real tabs.
- `mobile/store/useMapStore.ts` — keep (region only; no change required).
- `mobile/package.json` — deps + jest preset + type-check script.

Remove:
- `mobile/app/(tabs)/two.tsx` (scaffold).
- `expo-maps` dependency (unused).

---

# Phase 1 — Foundation

### Task 1: Dependencies, jest preset, scripts, env example

**Files:**
- Modify: `mobile/package.json`
- Create: `mobile/.env.example`

- [ ] **Step 1: Install/remove dependencies**

Run (from `mobile/`):
```bash
npx expo install expo-secure-store react-native-svg
npm install react-native-chart-kit
npm uninstall expo-maps
```
Expected: deps added to `package.json`; `expo-maps` removed.

- [ ] **Step 2: Add jest preset + scripts to `mobile/package.json`**

Add a `jest` block and two scripts (merge into the existing `scripts`):
```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest",
    "type-check": "tsc --noEmit"
  },
  "jest": {
    "preset": "jest-expo"
  }
```

- [ ] **Step 3: Create `mobile/.env.example`**

```bash
# Expo build-time env (EXPO_PUBLIC_* is inlined into the app bundle).
# Base URL of the Django API. On a physical device this must be your dev
# machine's LAN IP (e.g. http://192.168.1.50:8000/api), NOT localhost.
EXPO_PUBLIC_API_URL=http://localhost:8000/api

# Google Maps key (consumed by app.config.js for the react-native-maps provider).
GOOGLE_MAPS_API_KEY=
```

- [ ] **Step 4: Checkpoint**

Run: `npm run type-check`
Expected: PASS (no type errors from the dependency changes). Pause for user review.

---

### Task 2: API configuration

**Files:**
- Create: `mobile/config/api.ts`

- [ ] **Step 1: Write `mobile/config/api.ts`**

```typescript
// Base URL of the Django API and the derived django-allauth headless origin.
// EXPO_PUBLIC_* vars are inlined at build time. On a physical device, set
// EXPO_PUBLIC_API_URL to your dev machine's LAN IP (localhost won't resolve).
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

// allauth lives at the site root (sibling of /api); strip a trailing /api.
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export const ALLAUTH_ENDPOINT = `${API_ORIGIN}/_allauth/app/v1/auth`;
```

- [ ] **Step 2: Checkpoint**

Run: `npm run type-check`
Expected: PASS.

---

### Task 3: GeoJSON types + backend transform (TDD)

**Files:**
- Create: `mobile/lib/geojson.ts`
- Test: `mobile/lib/__tests__/geojson.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/lib/__tests__/geojson.test.ts
import { backendItemsToFeatureCollection } from '../geojson';

describe('backendItemsToFeatureCollection', () => {
  it('converts a paginated {items} payload to a FeatureCollection', () => {
    const payload = {
      items: [
        { id: 1, name: 'A', description: 'x', geojson: { type: 'Polygon', coordinates: [] } },
      ],
      count: 1,
    };
    const fc = backendItemsToFeatureCollection(payload);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0].geometry).toEqual({ type: 'Polygon', coordinates: [] });
    expect(fc.features[0].properties).toEqual({ id: 1, name: 'A', description: 'x' });
    expect(fc.features[0].id).toBe(1);
  });

  it('accepts a bare array and tolerates null/empty', () => {
    expect(backendItemsToFeatureCollection([]).features).toHaveLength(0);
    expect(backendItemsToFeatureCollection(null).features).toHaveLength(0);
    expect(backendItemsToFeatureCollection({ items: [{ id: 2, geojson: { type: 'Point', coordinates: [0, 0] } }] }).features[0].properties).toEqual({ id: 2 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/geojson.test.ts`
Expected: FAIL ("Cannot find module '../geojson'").

- [ ] **Step 3: Write `mobile/lib/geojson.ts`**

```typescript
// Minimal GeoJSON types (avoids adding @types/geojson) and the transform that
// turns this template's paginated API payload into a FeatureCollection.
export type Feature = {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, any>;
  geometry: any;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
};

export function backendItemsToFeatureCollection(payload: any): FeatureCollection {
  const items: any[] = Array.isArray(payload) ? payload : payload?.items ?? [];
  return {
    type: 'FeatureCollection',
    features: items.map((item) => {
      const { geojson, ...properties } = item;
      return { type: 'Feature', id: item.id, properties, geometry: geojson };
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/geojson.test.ts`
Expected: PASS (both tests).

- [ ] **Step 5: Checkpoint**

Run: `npm run type-check`
Expected: PASS. Pause for review.

---

### Task 4: Layer registry (TDD)

**Files:**
- Create: `mobile/config/layers.ts`
- Test: `mobile/config/__tests__/layers.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/config/__tests__/layers.test.ts
import { LAYER_CONFIGS, PRIMARY_LAYER, formatPopupValue } from '../layers';

describe('layer registry', () => {
  it('has exactly one primary layer and it is PRIMARY_LAYER', () => {
    const primaries = LAYER_CONFIGS.filter((l) => l.primary);
    expect(primaries).toHaveLength(1);
    expect(PRIMARY_LAYER).toBe(primaries[0]);
  });

  it('every layer has an id, name, source kind, and style', () => {
    for (const l of LAYER_CONFIGS) {
      expect(l.id).toBeTruthy();
      expect(l.name).toBeTruthy();
      expect(['geojson-url', 'backend']).toContain(l.source.kind);
      expect(l.style.lineColor).toBeTruthy();
    }
  });

  it('formats popup values', () => {
    expect(formatPopupValue(1.234, 'number2')).toBe('1.23');
    expect(formatPopupValue(undefined)).toBe('N/A');
    expect(formatPopupValue('Clayton')).toBe('Clayton');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest config/__tests__/layers.test.ts`
Expected: FAIL ("Cannot find module '../layers'").

- [ ] **Step 3: Write `mobile/config/layers.ts`**

```typescript
// Layer registry — the single source of map layer definitions (TS mirror of
// the web client's src/layers.js). Add/swap a layer here, not in the screens.
export type LayerSource =
  | { kind: 'geojson-url'; url: string }
  | { kind: 'backend'; endpoint: string };

export type LayerStyle = {
  lineColor: string;
  fillColor: string;
  lineWidth?: number;
  fillOpacity?: number;
};

export type PopupRow = { label: string; field: string; format?: 'number2' };
export type Column = { field: string; headerName: string };
export type CategoricalFilter = { field: string; label: string };
export type RangeFilter = { field: string; label: string };
export type DashboardConfig = { categoryField: string; valueField: string; valueLabel: string };

export type LayerConfig = {
  id: string;
  name: string;
  primary?: boolean;
  visible: boolean;
  source: LayerSource;
  style: LayerStyle;
  idField?: string;
  popup?: { titleField: string; rows: PopupRow[] };
  columns?: Column[];
  categoricalFilters?: CategoricalFilter[];
  rangeFilter?: RangeFilter;
  dashboard?: DashboardConfig;
};

const MUNI_GEOJSON_URL =
  process.env.EXPO_PUBLIC_MUNI_GEOJSON_URL ??
  'https://services2.arcgis.com/w657bnjzrjguNyOy/ArcGIS/rest/services/Municipal_Boundaries_Line/FeatureServer/1/query?where=1%3D1&outFields=*&f=geojson';

export const LAYER_CONFIGS: LayerConfig[] = [
  {
    id: 'st-louis-municipalities',
    name: 'St. Louis Municipalities',
    primary: true,
    visible: true,
    source: { kind: 'geojson-url', url: MUNI_GEOJSON_URL },
    style: { lineColor: '#0000ff', fillColor: '#0000ff', fillOpacity: 0.1, lineWidth: 2 },
    idField: 'OBJECTID',
    popup: {
      titleField: 'MUNICIPALITY',
      rows: [
        { label: 'Code', field: 'MUNICODE' },
        { label: 'Square Miles', field: 'SQ_MILES', format: 'number2' },
      ],
    },
    columns: [
      { field: 'MUNICIPALITY', headerName: 'Municipality' },
      { field: 'MUNICODE', headerName: 'Code' },
      { field: 'SQ_MILES', headerName: 'Sq Miles' },
    ],
    categoricalFilters: [
      { field: 'MUNICIPALITY', label: 'Municipality Names' },
      { field: 'MUNICODE', label: 'Municipal Codes' },
    ],
    rangeFilter: { field: 'SQ_MILES', label: 'Area (sq mi)' },
    dashboard: { categoryField: 'MUNICIPALITY', valueField: 'SQ_MILES', valueLabel: 'Square Miles' },
  },
  {
    id: 'demo-polygons-backend',
    name: 'Demo Polygons (backend API)',
    visible: false,
    source: { kind: 'backend', endpoint: '/polygons' },
    style: { lineColor: '#2e7d32', fillColor: '#2e7d32', fillOpacity: 0.15, lineWidth: 2 },
    idField: 'id',
    popup: { titleField: 'name', rows: [{ label: 'Description', field: 'description' }] },
  },
];

export const PRIMARY_LAYER: LayerConfig =
  LAYER_CONFIGS.find((l) => l.primary) ?? LAYER_CONFIGS[0];

export function formatPopupValue(value: any, format?: 'number2'): string {
  if (value === null || value === undefined || value === '') return 'N/A';
  if (format === 'number2') {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : 'N/A';
  }
  return String(value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest config/__tests__/layers.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

Run: `npm run type-check`
Expected: PASS.

---

### Task 5: Pure filter logic (TDD)

**Files:**
- Create: `mobile/lib/filters.ts`
- Test: `mobile/lib/__tests__/filters.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// mobile/lib/__tests__/filters.test.ts
import { filterFeatures, uniqueValues } from '../filters';
import { FeatureCollection } from '../geojson';

const fc: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { MUNICIPALITY: 'A', SQ_MILES: 2 }, geometry: null },
    { type: 'Feature', properties: { MUNICIPALITY: 'B', SQ_MILES: 8 }, geometry: null },
    { type: 'Feature', properties: { MUNICIPALITY: 'C', SQ_MILES: 5 }, geometry: null },
  ],
};
const cfg = { categoricalFilters: [{ field: 'MUNICIPALITY', label: '' }], rangeFilter: { field: 'SQ_MILES', label: '' } };

describe('filterFeatures', () => {
  it('returns all when no filters set', () => {
    const out = filterFeatures(fc, cfg, { categorical: {}, rangeMin: '', rangeMax: '' });
    expect(out.features).toHaveLength(3);
  });
  it('applies categorical and range filters', () => {
    const out = filterFeatures(fc, cfg, { categorical: { MUNICIPALITY: ['A', 'C'] }, rangeMin: '3', rangeMax: '' });
    expect(out.features.map((f) => f.properties.MUNICIPALITY)).toEqual(['C']);
  });
});

describe('uniqueValues', () => {
  it('returns sorted unique non-empty values', () => {
    expect(uniqueValues(fc, 'MUNICIPALITY')).toEqual(['A', 'B', 'C']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest lib/__tests__/filters.test.ts`
Expected: FAIL ("Cannot find module '../filters'").

- [ ] **Step 3: Write `mobile/lib/filters.ts`**

```typescript
import { FeatureCollection } from './geojson';

export type FilterState = {
  categorical: Record<string, (string | number)[]>;
  rangeMin: string;
  rangeMax: string;
};

type FilterConfig = {
  categoricalFilters?: { field: string }[];
  rangeFilter?: { field: string };
};

export function filterFeatures(
  fc: FeatureCollection | null,
  config: FilterConfig,
  filters: FilterState,
): FeatureCollection {
  if (!fc?.features) return { type: 'FeatureCollection', features: [] };
  const rangeField = config.rangeFilter?.field;
  const min = filters.rangeMin !== '' ? parseFloat(filters.rangeMin) : null;
  const max = filters.rangeMax !== '' ? parseFloat(filters.rangeMax) : null;

  const features = fc.features.filter((feature) => {
    const props = feature.properties || {};
    for (const [field, selected] of Object.entries(filters.categorical)) {
      if (selected.length > 0 && !selected.includes(props[field])) return false;
    }
    if (rangeField && (min !== null || max !== null)) {
      const v = props[rangeField];
      if (!Number.isFinite(v)) return false;
      if (min !== null && v < min) return false;
      if (max !== null && v > max) return false;
    }
    return true;
  });
  return { ...fc, features };
}

export function uniqueValues(fc: FeatureCollection | null, field: string): (string | number)[] {
  if (!fc?.features) return [];
  const vals = fc.features
    .map((f) => f.properties?.[field])
    .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
  return [...new Set(vals)].sort();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest lib/__tests__/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 6: Secure-storage adapter for Zustand persist

**Files:**
- Create: `mobile/store/secureStorage.ts`

- [ ] **Step 1: Write `mobile/store/secureStorage.ts`**

```typescript
import * as SecureStore from 'expo-secure-store';
import { StateStorage } from 'zustand/middleware';

// Zustand persist storage backed by expo-secure-store (good for auth tokens).
// SecureStore keys must be alphanumeric + ._-; the store name 'auth-storage' is fine.
export const secureStorage: StateStorage = {
  getItem: async (name) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name, value) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    await SecureStore.deleteItemAsync(name);
  },
};
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 7: Auth store

**Files:**
- Create: `mobile/store/useAuthStore.ts`

- [ ] **Step 1: Write `mobile/store/useAuthStore.ts`**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ALLAUTH_ENDPOINT } from '../config/api';
import { secureStorage } from './secureStorage';

type AuthResult = { success: boolean; message?: string; verificationPending?: boolean };

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  signup: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      sessionToken: null,

      login: async (email, password) => {
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, isAuthenticated: true, sessionToken: data.meta.session_token });
            return { success: true, message: 'Login successful!' };
          }
          return { success: false, message: data.error || 'Invalid credentials' };
        } catch {
          return { success: false, message: 'Server error. Please try again later.' };
        }
      },

      signup: async ({ email, password, first_name, last_name }) => {
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username: email, password, first_name, last_name }),
          });
          const data = await res.json();
          if (res.status === 401 && data.data?.flows) {
            const pending = data.data.flows.find(
              (f: any) => f.id === 'verify_email' && f.is_pending,
            );
            if (pending) {
              return {
                success: false,
                verificationPending: true,
                message: 'A verification email has been sent. Verify on the web, then log in here.',
              };
            }
          }
          return { success: false, message: data.error || 'Signup failed' };
        } catch {
          return { success: false, message: 'Server error. Please try again later.' };
        }
      },

      logout: async () => {
        const token = get().sessionToken;
        if (!token) {
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: true };
        }
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/session`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          });
          // allauth returns 401 once the session is gone.
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: res.status === 401 || res.ok };
        } catch {
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: false, message: 'Server error, but session cleared locally.' };
        }
      },

      fetchUser: async () => {
        const token = get().sessionToken;
        if (!token) return;
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/session`, {
            headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          });
          const result = await res.json();
          if (result?.data?.user) {
            set({ user: result.data.user, isAuthenticated: true });
          } else {
            set({ user: null, isAuthenticated: false, sessionToken: null });
          }
        } catch {
          // keep persisted token; user can retry
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ sessionToken: s.sessionToken, user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 8: Layer store

**Files:**
- Create: `mobile/store/useLayerStore.ts`

- [ ] **Step 1: Write `mobile/store/useLayerStore.ts`**

```typescript
import { create } from 'zustand';
import { API_BASE } from '../config/api';
import { LAYER_CONFIGS, PRIMARY_LAYER, LayerConfig } from '../config/layers';
import { FeatureCollection, backendItemsToFeatureCollection } from '../lib/geojson';
import { FilterState, filterFeatures, uniqueValues } from '../lib/filters';
import { useAuthStore } from './useAuthStore';

type LayerRuntime = LayerConfig & { data: FeatureCollection | null };

interface LayerState {
  layers: Record<string, LayerRuntime>;
  filters: FilterState;
  fetchLayers: () => Promise<void>;
  toggleLayerVisibility: (id: string) => void;
  setCategoricalFilter: (field: string, values: (string | number)[]) => void;
  setRange: (which: 'rangeMin' | 'rangeMax', value: string) => void;
  resetFilters: () => void;
  getFilteredPrimaryData: () => FeatureCollection | null;
  getUniqueValues: (field: string) => (string | number)[];
}

const initialLayers: Record<string, LayerRuntime> = Object.fromEntries(
  LAYER_CONFIGS.map((c) => [c.id, { ...c, data: null }]),
);

const initialCategorical: Record<string, (string | number)[]> = Object.fromEntries(
  (PRIMARY_LAYER.categoricalFilters || []).map((f) => [f.field, []]),
);

async function loadLayerData(config: LayerConfig): Promise<FeatureCollection> {
  if (config.source.kind === 'backend') {
    const headers: Record<string, string> = {};
    const token = useAuthStore.getState().sessionToken;
    if (token) headers['X-Session-Token'] = token;
    const res = await fetch(`${API_BASE}${config.source.endpoint}`, { headers });
    if (!res.ok) throw new Error(`Layer "${config.id}" backend HTTP ${res.status}`);
    return backendItemsToFeatureCollection(await res.json());
  }
  const res = await fetch(config.source.url);
  return (await res.json()) as FeatureCollection;
}

export const useLayerStore = create<LayerState>((set, get) => ({
  layers: initialLayers,
  filters: { categorical: initialCategorical, rangeMin: '', rangeMax: '' },

  fetchLayers: async () => {
    const results = await Promise.allSettled(
      LAYER_CONFIGS.map((c) => loadLayerData(c).then((data) => ({ id: c.id, data }))),
    );
    set((state) => {
      const layers = { ...state.layers };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          layers[r.value.id] = { ...layers[r.value.id], data: r.value.data };
        } else {
          console.error('Error fetching layer:', r.reason);
        }
      }
      return { layers };
    });
  },

  toggleLayerVisibility: (id) =>
    set((state) => ({
      layers: { ...state.layers, [id]: { ...state.layers[id], visible: !state.layers[id].visible } },
    })),

  setCategoricalFilter: (field, values) =>
    set((state) => ({
      filters: { ...state.filters, categorical: { ...state.filters.categorical, [field]: values } },
    })),

  setRange: (which, value) =>
    set((state) => ({ filters: { ...state.filters, [which]: value } })),

  resetFilters: () =>
    set({ filters: { categorical: { ...initialCategorical }, rangeMin: '', rangeMax: '' } }),

  getFilteredPrimaryData: () => {
    const data = get().layers[PRIMARY_LAYER.id]?.data ?? null;
    return filterFeatures(data, PRIMARY_LAYER, get().filters);
  },

  getUniqueValues: (field) => uniqueValues(get().layers[PRIMARY_LAYER.id]?.data ?? null, field),
}));
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS. Then `npx jest` → all Phase-1 tests PASS. Pause for review.

---

### Task 9: Three-tab navigation

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/dashboard.tsx` (placeholder), `mobile/app/(tabs)/account.tsx` (placeholder)
- Remove: `mobile/app/(tabs)/two.tsx`

- [ ] **Step 1: Replace `mobile/app/(tabs)/_layout.tsx`**

```tsx
import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={26} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Map', tabBarIcon: ({ color }) => <TabBarIcon name="map" color={color} /> }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Dashboard', tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} /> }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Create placeholder `mobile/app/(tabs)/dashboard.tsx`**

```tsx
import { Text, View } from '@/components/Themed';

export default function DashboardScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Dashboard</Text>
    </View>
  );
}
```

- [ ] **Step 3: Create placeholder `mobile/app/(tabs)/account.tsx`**

```tsx
import { Text, View } from '@/components/Themed';

export default function AccountScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Account</Text>
    </View>
  );
}
```

- [ ] **Step 4: Remove the scaffold screen**

Run: `git rm mobile/app/\(tabs\)/two.tsx` (or delete the file). The `index.tsx` map screen already exists and is rebuilt in Phase 2.

- [ ] **Step 5: Checkpoint**

Run: `npm run type-check` → PASS.
Run: `npm start`, open the app → three tabs (Map / Dashboard / Account) render; placeholders show. Pause for review.

---

# Phase 2 — Map screen

### Task 10: Search bar (Nominatim)

**Files:**
- Create: `mobile/components/SearchBar.tsx`

- [ ] **Step 1: Write `mobile/components/SearchBar.tsx`**

```tsx
import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';

export type SearchResult = { latitude: number; longitude: number };

export default function SearchBar({ onResult }: { onResult: (r: SearchResult) => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`,
        { headers: { 'User-Agent': 'webgis-mobile-template' } },
      );
      const results = await res.json();
      if (results.length > 0) {
        onResult({ latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) });
      } else {
        Alert.alert('Not found', 'No location matched your search.');
      }
    } catch {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder="Search location"
        value={text}
        onChangeText={setText}
        onSubmitEditing={search}
        returnKeyType="search"
      />
      <TouchableOpacity style={styles.button} onPress={search} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : 'Go'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'white', borderRadius: 6, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: '#ccc' },
  button: { backgroundColor: '#1976d2', borderRadius: 6, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 11: Feature-detail panel

**Files:**
- Create: `mobile/components/FeatureDetail.tsx`

- [ ] **Step 1: Write `mobile/components/FeatureDetail.tsx`**

```tsx
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LayerConfig, formatPopupValue } from '../config/layers';

export type SelectedFeature = { layer: LayerConfig; properties: Record<string, any> };

export default function FeatureDetail({
  selected,
  onClose,
}: {
  selected: SelectedFeature | null;
  onClose: () => void;
}) {
  if (!selected?.layer.popup) return null;
  const { titleField, rows } = selected.layer.popup;
  const props = selected.properties || {};
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{props[titleField] ?? 'N/A'}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      {rows.map((r) => (
        <Text key={r.field} style={styles.row}>
          <Text style={styles.label}>{r.label}: </Text>
          {formatPopupValue(props[r.field], r.format)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: 'white', borderRadius: 10, padding: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: '#1976d2' },
  close: { fontSize: 18, color: '#666', paddingHorizontal: 8 },
  row: { marginVertical: 2 },
  label: { fontWeight: '600' },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 12: MapViewWrapper (map + OSM tiles + GeoJSON overlays + tap + search + GPS/home)

**Files:**
- Modify (full rewrite): `mobile/components/MapViewWrapper.tsx`

- [ ] **Step 1: Rewrite `mobile/components/MapViewWrapper.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { UrlTile, Geojson, Region } from 'react-native-maps';
import useLocation from '@/hooks/useLocation';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER, LayerConfig } from '@/config/layers';
import SearchBar from './SearchBar';
import FeatureDetail, { SelectedFeature } from './FeatureDetail';

const DEFAULT_REGION: Region = {
  latitude: 38.64,
  longitude: -90.3,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export default function MapViewWrapper({ controls }: { controls?: React.ReactNode }) {
  const mapRef = useRef<MapView>(null);
  const layers = useLayerStore((s) => s.layers);
  const fetchLayers = useLayerStore((s) => s.fetchLayers);
  const getFilteredPrimaryData = useLayerStore((s) => s.getFilteredPrimaryData);
  const filters = useLayerStore((s) => s.filters);
  const location = useLocation();
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  const visibleLayers = Object.values(layers).filter((l) => l.visible && l.data);
  const dataForLayer = (l: LayerConfig & { data: any }) =>
    l.id === PRIMARY_LAYER.id ? getFilteredPrimaryData() : l.data;

  const goHome = () => mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  const goToMe = () =>
    location &&
    mapRef.current?.animateToRegion(
      { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      500,
    );

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation>
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        {visibleLayers.map((l) => {
          const fc = dataForLayer(l);
          if (!fc) return null;
          return (
            <Geojson
              key={`${l.id}-${filters.rangeMin}-${filters.rangeMax}`}
              geojson={fc as any}
              strokeColor={l.style.lineColor}
              fillColor={rgba(l.style.fillColor, l.style.fillOpacity ?? 0.1)}
              strokeWidth={l.style.lineWidth ?? 2}
              tappable
              onPress={(e: any) => setSelected({ layer: l, properties: e?.feature?.properties ?? {} })}
            />
          );
        })}
      </MapView>

      <View style={styles.topBar}>
        <SearchBar onResult={(r) => mapRef.current?.animateToRegion({ ...r, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500)} />
      </View>

      <View style={styles.sideButtons}>
        <TouchableOpacity style={styles.iconButton} onPress={goHome}>
          <Text style={styles.icon}>⌂</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={goToMe}>
          <Text style={styles.icon}>◎</Text>
        </TouchableOpacity>
      </View>

      {controls}
      <FeatureDetail selected={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topBar: { position: 'absolute', top: 10, left: 10, right: 10 },
  sideButtons: { position: 'absolute', top: 64, left: 10, gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 6, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  icon: { fontSize: 20 },
});
```

> **Integration note:** `react-native-maps` `<Geojson onPress>` passes the pressed feature as `e.feature`. If your installed version differs, log `e` once and adjust the `properties` extraction. Fallback (per spec): make features `tappable` and resolve the nearest feature from the rendered FeatureCollection on map press.

- [ ] **Step 2: Wire the Map screen `mobile/app/(tabs)/index.tsx`**

```tsx
import MapViewWrapper from '@/components/MapViewWrapper';

export default function MapScreen() {
  return <MapViewWrapper />;
}
```

- [ ] **Step 3: Checkpoint**

Run: `npm run type-check` → PASS.
Run: `npm start` / `expo run:android` (or ios) on a device/emulator with the backend reachable (set `EXPO_PUBLIC_API_URL` to the LAN IP). Verify: OSM tiles render, the municipalities layer draws, tapping a feature opens the detail card, search recenters, Home/GPS buttons work. Pause for review.

---

# Phase 3 — Controls (layers, filters, list)

### Task 13: Layer controls (toggles + open filters/list)

**Files:**
- Create: `mobile/components/LayerControls.tsx`

- [ ] **Step 1: Write `mobile/components/LayerControls.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';

export default function LayerControls({
  onOpenFilters,
  onOpenList,
}: {
  onOpenFilters: () => void;
  onOpenList: () => void;
}) {
  const [open, setOpen] = useState(false);
  const layers = useLayerStore((s) => s.layers);
  const toggle = useLayerStore((s) => s.toggleLayerVisibility);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.fab} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.fabText}>{open ? '✕' : '☰'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.heading}>Layers</Text>
          {Object.values(layers).map((l) => (
            <TouchableOpacity key={l.id} style={styles.layerRow} onPress={() => toggle(l.id)}>
              <View style={[styles.swatch, { backgroundColor: l.style.fillColor, borderColor: l.style.lineColor }]} />
              <Text style={styles.layerName}>{l.visible ? '☑' : '☐'} {l.name}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={onOpenFilters}>
              <Text style={styles.actionText}>Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onOpenList}>
              <Text style={styles.actionText}>List</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 10, top: 64, alignItems: 'flex-end' },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1976d2', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  fabText: { color: 'white', fontSize: 20 },
  panel: { marginTop: 8, backgroundColor: 'white', borderRadius: 10, padding: 12, width: 230, elevation: 4 },
  heading: { fontWeight: '700', marginBottom: 8 },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  swatch: { width: 22, height: 14, borderRadius: 3, borderWidth: 2 },
  layerName: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: { flex: 1, backgroundColor: '#eee', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  actionText: { fontWeight: '600' },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 14: Filters modal

**Files:**
- Create: `mobile/components/FiltersModal.tsx`

- [ ] **Step 1: Write `mobile/components/FiltersModal.tsx`**

```tsx
import { Modal, View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';

export default function FiltersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const filters = useLayerStore((s) => s.filters);
  const setCategorical = useLayerStore((s) => s.setCategoricalFilter);
  const setRange = useLayerStore((s) => s.setRange);
  const reset = useLayerStore((s) => s.resetFilters);
  const getUniqueValues = useLayerStore((s) => s.getUniqueValues);

  const toggleValue = (field: string, value: string | number) => {
    const current = filters.categorical[field] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setCategorical(field, next);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {(PRIMARY_LAYER.categoricalFilters || []).map((f) => (
            <View key={f.field} style={{ marginBottom: 18 }}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.chips}>
                {getUniqueValues(f.field).map((v) => {
                  const active = (filters.categorical[f.field] || []).includes(v);
                  return (
                    <TouchableOpacity
                      key={String(v)}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleValue(f.field, v)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{String(v)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {PRIMARY_LAYER.rangeFilter && (
            <View>
              <Text style={styles.label}>{PRIMARY_LAYER.rangeFilter.label}</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Min"
                  keyboardType="numeric"
                  value={filters.rangeMin}
                  onChangeText={(t) => setRange('rangeMin', t)}
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Max"
                  keyboardType="numeric"
                  value={filters.rangeMax}
                  onChangeText={(t) => setRange('rangeMax', t)}
                />
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetText}>Reset filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700' },
  close: { color: '#1976d2', fontWeight: '600', fontSize: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#bbb', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  chipText: { color: '#333' },
  chipTextActive: { color: 'white' },
  rangeRow: { flexDirection: 'row', gap: 12 },
  rangeInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 },
  resetBtn: { marginTop: 24, backgroundColor: '#eee', borderRadius: 6, padding: 12, alignItems: 'center' },
  resetText: { fontWeight: '600' },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 15: Feature list modal

**Files:**
- Create: `mobile/components/FeatureList.tsx`

- [ ] **Step 1: Write `mobile/components/FeatureList.tsx`**

```tsx
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';

export default function FeatureList({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const getFilteredPrimaryData = useLayerStore((s) => s.getFilteredPrimaryData);
  const features = getFilteredPrimaryData()?.features ?? [];
  const columns = PRIMARY_LAYER.columns ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Features ({features.length})</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={features}
          keyExtractor={(f, i) => String(f.properties?.[PRIMARY_LAYER.idField ?? ''] ?? f.id ?? i)}
          ListEmptyComponent={<Text style={styles.empty}>No features.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {columns.map((c) => (
                <Text key={c.field} style={styles.cell}>
                  <Text style={styles.cellLabel}>{c.headerName}: </Text>
                  {String(item.properties?.[c.field] ?? '')}
                </Text>
              ))}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700' },
  close: { color: '#1976d2', fontWeight: '600', fontSize: 16 },
  row: { padding: 14, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  cell: { marginVertical: 1 },
  cellLabel: { fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
```

- [ ] **Step 2: Integrate controls into the Map screen — rewrite `mobile/app/(tabs)/index.tsx`**

```tsx
import { useState } from 'react';
import MapViewWrapper from '@/components/MapViewWrapper';
import LayerControls from '@/components/LayerControls';
import FiltersModal from '@/components/FiltersModal';
import FeatureList from '@/components/FeatureList';

export default function MapScreen() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  return (
    <>
      <MapViewWrapper
        controls={<LayerControls onOpenFilters={() => setFiltersOpen(true)} onOpenList={() => setListOpen(true)} />}
      />
      <FiltersModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <FeatureList visible={listOpen} onClose={() => setListOpen(false)} />
    </>
  );
}
```

- [ ] **Step 3: Checkpoint**

Run: `npm run type-check` → PASS.
Manual: open the layer FAB → toggle the backend layer, open Filters → select a municipality / set a max area and confirm the map + list narrow, open List → see rows. Pause for review.

---

# Phase 4 — Dashboard + Account

### Task 16: Dashboard charts

**Files:**
- Modify (full): `mobile/app/(tabs)/dashboard.tsx`

- [ ] **Step 1: Write `mobile/app/(tabs)/dashboard.tsx`**

```tsx
import { ScrollView, View, Text, Dimensions, StyleSheet } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';

const width = Dimensions.get('window').width - 24;
const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (o = 1) => `rgba(25, 118, 210, ${o})`,
  labelColor: () => '#333',
  decimalPlaces: 1,
};
const PIE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

export default function DashboardScreen() {
  const getFilteredPrimaryData = useLayerStore((s) => s.getFilteredPrimaryData);
  const { categoryField, valueField, valueLabel } = PRIMARY_LAYER.dashboard!;
  const features = getFilteredPrimaryData()?.features ?? [];

  const rows = features
    .map((f) => ({ name: String(f.properties?.[categoryField] ?? ''), value: Number(f.properties?.[valueField] ?? 0) }))
    .filter((r) => Number.isFinite(r.value));
  const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 6);

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No data loaded yet. Open the Map tab first.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.h1}>GIS Dashboard</Text>
      <Text style={styles.h2}>{valueLabel} — top {top.length}</Text>
      <BarChart
        data={{ labels: top.map((r) => r.name.slice(0, 6)), datasets: [{ data: top.map((r) => r.value) }] }}
        width={width}
        height={240}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={chartConfig}
        verticalLabelRotation={30}
        fromZero
      />
      <Text style={styles.h2}>Distribution</Text>
      <PieChart
        data={top.map((r, i) => ({ name: r.name.slice(0, 8), population: r.value, color: PIE_COLORS[i % PIE_COLORS.length], legendFontColor: '#333', legendFontSize: 12 }))}
        width={width}
        height={220}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="8"
        chartConfig={chartConfig}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 8 },
});
```

- [ ] **Step 2: Checkpoint**

Run: `npm run type-check` → PASS.
Manual: load the Map tab (so layer data is fetched), switch to Dashboard → bar + pie charts render. Pause for review.

---

### Task 17: Auth form

**Files:**
- Create: `mobile/components/AuthForm.tsx`

- [ ] **Step 1: Write `mobile/components/AuthForm.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);

  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);

  const submit = async () => {
    setBusy(true);
    const res =
      mode === 'login'
        ? await login(email, password)
        : await signup({ email, password, first_name: firstName, last_name: lastName });
    setBusy(false);
    if (!res.success) Alert.alert(mode === 'login' ? 'Login' : 'Sign up', res.message ?? 'Failed');
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {mode === 'signup' && (
        <>
          <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />
        </>
      )}
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '...' : mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.switch}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12 },
  button: { backgroundColor: '#1976d2', borderRadius: 6, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  switch: { color: '#1976d2', textAlign: 'center', marginTop: 8 },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 18: Account screen (auth gate + profile)

**Files:**
- Modify (full): `mobile/app/(tabs)/account.tsx`

- [ ] **Step 1: Write `mobile/app/(tabs)/account.tsx`**

```tsx
import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import AuthForm from '@/components/AuthForm';

export default function AccountScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!isAuthenticated) return <AuthForm />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      <Text style={styles.email}>{user?.email ?? user?.username ?? ''}</Text>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  title: { fontSize: 20, fontWeight: '700' },
  email: { color: '#555' },
  button: { backgroundColor: '#d32f2f', borderRadius: 6, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: Checkpoint** — Run: `npm run type-check` → PASS.

---

### Task 19: Mobile README update + final verification

**Files:**
- Modify: `mobile/README.md` (Run section: document `EXPO_PUBLIC_API_URL` + LAN-IP caveat; note feature parity and the PMTiles roadmap gap)

- [ ] **Step 1: Update `mobile/README.md` "Run it" section**

Add under the run instructions:
```markdown
Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`. On a **physical
device** this must be your dev machine's LAN IP (e.g. `http://192.168.1.50:8000/api`),
not `localhost`. The client now has feature parity with the web client (config-driven
layers, search, layer toggles, filters, feature list, dashboard, login/signup); the
PMTiles vector basemap remains the documented roadmap gap (mobile uses OSM raster tiles).
```

- [ ] **Step 2: Full automated verification**

Run (from `mobile/`):
```bash
npm run type-check
npx jest
```
Expected: `tsc` clean; all Phase-1 unit tests PASS.

- [ ] **Step 3: Full manual verification (against `docker compose up` backend)**

Walk the checklist:
- Map tab: OSM tiles + municipalities layer render; tap a feature → detail card; search recenters; Home/GPS work.
- Toggle `Demo Polygons (backend API)` on (create one via the web/API first) → it renders.
- Filters: select a municipality and/or set a max area → map + list narrow.
- List: shows the configured columns.
- Dashboard: bar + pie charts draw from the primary layer.
- Account: sign up (get the "verify on web" message), then log in; relaunch the app and confirm the session persists (Account shows signed-in).

- [ ] **Step 4: Checkpoint** — Pause for final user review. (User commits.)

---

## Self-review (completed by plan author)

**Spec coverage:**
- Config-driven layer registry → Task 4. Backend transform → Task 3. Filtering → Task 5.
- Stores (layer + auth + secure persistence) → Tasks 6-8. API config → Task 2.
- 3-tab nav → Task 9. Map + tiles + GeoJSON + tap + search + GPS/home → Tasks 10-12.
- Layer toggles → Task 13. Filters → Task 14. Feature list → Task 15.
- Dashboard charts → Task 16. Auth login/signup + profile → Tasks 17-18.
- Deps (expo-secure-store, chart-kit, svg; remove expo-maps) + env → Task 1. README/docs → Task 19.
- Testing (jest logic units + type-check + manual) → Tasks 3-5, 19.

**Out-of-scope items** (PMTiles/MapLibre, offline, deep-link verify) are intentionally not tasked.

**Type consistency:** `LayerConfig`, `FeatureCollection`, `FilterState`, `useLayerStore`, `useAuthStore`, `PRIMARY_LAYER`, `formatPopupValue`, `backendItemsToFeatureCollection`, `filterFeatures`, `uniqueValues`, `getFilteredPrimaryData`, `getUniqueValues`, `setCategoricalFilter`, `setRange` are defined once and referenced consistently across tasks.
