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
