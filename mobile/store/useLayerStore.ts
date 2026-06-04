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
