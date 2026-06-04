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
