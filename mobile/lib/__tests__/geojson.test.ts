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
