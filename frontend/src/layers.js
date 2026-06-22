// Layer registry — the single place that describes the map's data layers.
//
// Add or swap a layer by editing this list, NOT the components: the store
// (useStore.js) fetches each layer's data, Mapview renders every visible layer
// from its `style`, and the sidebar/table/dashboard read the *primary* layer's
// field metadata (`columns`, `categoricalFilters`, `rangeFilter`, `dashboard`,
// `popup`) from here. Exactly one layer should set `primary: true`.
//
// A layer's `source` is one of:
//   { kind: 'geojson-url', url }       -> fetch a GeoJSON FeatureCollection
//   { kind: 'backend', endpoint }      -> fetch this template's own API
//                                         (GET `${VITE_API_URL}${endpoint}`),
//                                         whose {items:[{geojson,...}]} payload
//                                         the store converts to a FeatureCollection.

const MUNI_GEOJSON_URL =
    import.meta.env.VITE_MUNI_GEOJSON_URL ||
    'https://services2.arcgis.com/w657bnjzrjguNyOy/ArcGIS/rest/services/Municipal_Boundaries_Line/FeatureServer/1/query?where=1%3D1&outFields=*&f=geojson';

export const LAYER_CONFIGS = [
    {
        id: 'st-louis-municipalities',
        name: 'St. Louis Municipalities',
        primary: true, // drives the attribute table, dashboard, and sidebar filters
        visible: true,
        source: { kind: 'geojson-url', url: MUNI_GEOJSON_URL },
        style: { lineColor: '#414a59', fillColor: '#414a59', fillOpacity: 0.07, lineWidth: 1.25 },
        idField: 'OBJECTID',
        // Click popup: a title plus labelled rows. `format: 'number2'` -> 2 d.p.
        popup: {
            titleField: 'MUNICIPALITY',
            rows: [
                { label: 'Code', field: 'MUNICODE' },
                { label: 'Square Miles', field: 'SQ_MILES', format: 'number2' },
            ],
        },
        // Attribute-table columns (MUI DataGrid column defs).
        columns: [
            { field: 'OBJECTID', headerName: 'OBJECTID', flex: 1 },
            { field: 'MUNICIPALITY', headerName: 'Municipality', flex: 2 },
            { field: 'MUNI', headerName: 'MUNI Code', flex: 1 },
            { field: 'MUNICODE', headerName: 'Municipality Code', flex: 1 },
            { field: 'SQ_MILES', headerName: 'Square Miles', flex: 1, type: 'number' },
            { field: 'Shape__Area', headerName: 'Area', flex: 1, type: 'number' },
            { field: 'Shape__Length', headerName: 'Length', flex: 1, type: 'number' },
        ],
        // Sidebar "Query Attribute Data": categorical multi-selects + one range.
        categoricalFilters: [
            { field: 'MUNICIPALITY', label: 'Municipality Names' },
            { field: 'MUNICODE', label: 'Municipal Codes' },
        ],
        rangeFilter: { field: 'SQ_MILES', label: 'Area (sq mi)' },
        // Dashboard chart axes.
        dashboard: {
            categoryField: 'MUNICIPALITY',
            valueField: 'SQ_MILES',
            valueLabel: 'Square Miles',
        },
    },
    {
        // Example of consuming THIS template's own backend. It renders whatever
        // polygons exist via GET /api/polygons (empty until you create some, e.g.
        // through the API or Django admin). Off by default; toggle it in the
        // sidebar's "Map Layers" list. This is the canonical backend-fetch pattern.
        id: 'demo-polygons-backend',
        name: 'Demo Polygons (backend API)',
        visible: false,
        source: { kind: 'backend', endpoint: '/polygons' },
        style: { lineColor: '#2e8b73', fillColor: '#2e8b73', fillOpacity: 0.14, lineWidth: 1.5 },
        idField: 'id',
        popup: {
            titleField: 'name',
            rows: [{ label: 'Description', field: 'description' }],
        },
    },
];

// The layer whose attributes power the table, dashboard, and sidebar filters.
export const PRIMARY_LAYER = LAYER_CONFIGS.find((l) => l.primary) || LAYER_CONFIGS[0];

// Rough geographic center of a GeoJSON feature (bounding-box midpoint), returned
// as Leaflet-style [lat, lng] to match the store's convention. Used to fly the
// map to a feature when its result card is clicked.
export function featureCenter(feature) {
    const geom = feature?.geometry;
    if (!geom) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (coords) => {
        if (typeof coords[0] === 'number') {
            const [x, y] = coords;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        } else {
            for (const c of coords) visit(c);
        }
    };
    if (geom.type === 'Point') visit(geom.coordinates);
    else if (geom.coordinates) visit(geom.coordinates);
    if (!Number.isFinite(minX)) return null;
    return [(minY + maxY) / 2, (minX + maxX) / 2];
}

// Format a popup value per its row descriptor.
export function formatPopupValue(value, format) {
    if (value === null || value === undefined || value === '') return 'N/A';
    if (format === 'number2') {
        const n = Number(value);
        return Number.isFinite(n) ? n.toFixed(2) : 'N/A';
    }
    return value;
}
