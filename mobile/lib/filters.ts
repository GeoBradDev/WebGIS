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
      // Coerce so string-encoded numbers (common in GeoJSON exports) compare too.
      const v = Number(props[rangeField]);
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
