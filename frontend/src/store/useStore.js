import {create} from 'zustand';
import {DEFAULT_BASEMAP_ID} from '../mapStyle';
import {LAYER_CONFIGS, PRIMARY_LAYER} from '../layers';
import {useAuthStore} from './useAuthStore';

// Base URL of this template's own API (used by `source.kind === 'backend'` layers).
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

// Initial layer registry, built from the config in src/layers.js.
const initialLayers = Object.fromEntries(
    LAYER_CONFIGS.map((c) => [c.id, {...c, data: null}])
);

// Categorical filter state is keyed by the primary layer's filter fields.
const initialCategorical = Object.fromEntries(
    (PRIMARY_LAYER.categoricalFilters || []).map((f) => [f.field, []])
);

// Convert this template's paginated API payload ({items:[{geojson, ...props}]})
// into a GeoJSON FeatureCollection the map can render.
function backendItemsToFeatureCollection(payload) {
    const items = Array.isArray(payload) ? payload : payload?.items ?? [];
    return {
        type: 'FeatureCollection',
        features: items.map((item) => {
            const {geojson, ...properties} = item;
            return {type: 'Feature', id: item.id, properties, geometry: geojson};
        }),
    };
}

// Fetch one layer's data based on its source descriptor.
async function loadLayerData(config) {
    if (config.source.kind === 'backend') {
        // Demonstrates calling the template's own backend, attaching the allauth
        // session token when the user is signed in (the demo endpoints are public,
        // so this also works anonymously).
        const headers = {};
        const token = useAuthStore.getState().sessionToken;
        if (token) headers['X-Session-Token'] = token;
        const res = await fetch(`${API_URL}${config.source.endpoint}`, {headers});
        if (!res.ok) throw new Error(`Layer "${config.id}" backend HTTP ${res.status}`);
        return backendItemsToFeatureCollection(await res.json());
    }
    // Default: an external GeoJSON FeatureCollection URL.
    const res = await fetch(config.source.url);
    return res.json();
}

const useStore = create((set, get) => ({
    defaultCenter: [38.64, -90.3], // Default map center [lat, lng]
    mapCenter: [38.64, -90.3], // Default map center [lat, lng]
    setMapCenter: (newCenter) => set({mapCenter: newCenter}),

    // Active basemap id (see BASEMAPS in src/mapStyle.js).
    activeBasemap: DEFAULT_BASEMAP_ID,
    setActiveBasemap: (basemapId) => set({activeBasemap: basemapId}),

    userLocation: null,
    setUserLocation: (location) => {
        set(() => ({userLocation: location ? [...location] : null})); // Ensure a new array reference
    },

    currentView: 'map',
    toggleView: () =>
        set((state) => ({
            currentView: state.currentView === 'map' ? 'dashboard' : 'map',
        })),

    isTableCollapsed: true,
    toggleTable: () => set((state) => ({isTableCollapsed: !state.isTableCollapsed})),

    // The primary-layer feature currently selected from the result rail. Drives
    // the map highlight outline and the active card state (map<->card sync).
    selectedFeatureId: null,
    setSelectedFeatureId: (id) => set({selectedFeatureId: id}),

    aboutOpen: false, // State for dialog

    // Primary layer's data, mirrored here for the table/dashboard/sidebar.
    geojsonData: null,
    isDataLoaded: false,
    bounds: null,
    setBounds: (bounds) => set({bounds}),

    // Config-driven layer registry (see src/layers.js). Each entry carries its
    // config plus the fetched `data` (a GeoJSON FeatureCollection or null).
    layers: initialLayers,

    primaryLayerId: PRIMARY_LAYER.id,

    toggleLayerVisibility: (layerId) => set((state) => ({
        layers: {
            ...state.layers,
            [layerId]: {
                ...state.layers[layerId],
                visible: !state.layers[layerId].visible,
            }
        }
    })),

    // Load every configured layer. One failing layer doesn't block the others.
    fetchLayers: async () => {
        const results = await Promise.allSettled(
            LAYER_CONFIGS.map((c) => loadLayerData(c).then((data) => ({id: c.id, data})))
        );
        set((state) => {
            const layers = {...state.layers};
            let primaryData = state.geojsonData;
            for (const r of results) {
                if (r.status === 'fulfilled') {
                    const {id, data} = r.value;
                    layers[id] = {...layers[id], data};
                    if (id === PRIMARY_LAYER.id) primaryData = data;
                } else {
                    console.error('Error fetching layer:', r.reason);
                }
            }
            return {
                layers,
                geojsonData: primaryData,
                isDataLoaded: primaryData?.features?.length > 0,
            };
        });
    },

    // Filter state for the primary layer: categorical multi-selects keyed by
    // field name, plus a numeric range over the primary layer's range field.
    filters: {
        categorical: initialCategorical,
        rangeMin: '',
        rangeMax: '',
    },
    setCategoricalFilter: (field, values) => set((state) => ({
        filters: {
            ...state.filters,
            categorical: {...state.filters.categorical, [field]: values},
        },
    })),
    setRange: (which, value) => set((state) => ({
        filters: {...state.filters, [which]: value},
    })),
    resetFilters: () => set({
        filters: {categorical: {...initialCategorical}, rangeMin: '', rangeMax: ''},
    }),

    // Primary layer data with the active filters applied.
    getFilteredPrimaryData: () => {
        const {geojsonData, filters} = get();
        if (!geojsonData || !geojsonData.features) return geojsonData;

        const rangeField = PRIMARY_LAYER.rangeFilter?.field;
        const min = filters.rangeMin !== '' ? parseFloat(filters.rangeMin) : null;
        const max = filters.rangeMax !== '' ? parseFloat(filters.rangeMax) : null;

        const filteredFeatures = geojsonData.features.filter((feature) => {
            const props = feature.properties || {};

            // Categorical filters: each selected list must contain the value.
            for (const [field, selected] of Object.entries(filters.categorical)) {
                if (selected.length > 0 && !selected.includes(props[field])) return false;
            }

            // Numeric range filter (only applied when a bound is set).
            if (rangeField && (min !== null || max !== null)) {
                const value = props[rangeField];
                if (!Number.isFinite(value)) return false;
                if (min !== null && value < min) return false;
                if (max !== null && value > max) return false;
            }

            return true;
        });

        return {...geojsonData, features: filteredFeatures};
    },

    // Unique, sorted values for a primary-layer field (sidebar dropdown options).
    getUniqueValues: (field) => {
        const {geojsonData} = get();
        if (!geojsonData?.features) return [];
        const values = geojsonData.features
            .map((feature) => feature.properties?.[field])
            .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
        return [...new Set(values)].sort();
    },

    snackbar: {
        open: false,
        message: '',
        severity: 'success',
    },
    showSnackbar: (message, severity = 'success') =>
        set({
            snackbar: {open: true, message, severity},
        }),
    hideSnackbar: () =>
        set((state) => ({
            snackbar: {...state.snackbar, open: false},
        })),
}));

export default useStore;
