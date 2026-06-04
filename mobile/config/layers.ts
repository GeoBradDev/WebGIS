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
