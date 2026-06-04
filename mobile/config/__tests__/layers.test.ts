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
