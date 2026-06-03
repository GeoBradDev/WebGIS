// MapLibre style builder.
//
// Styles are assembled from environment variables (a static style.json cannot
// read import.meta.env). The default basemap is a PMTiles vector basemap when
// VITE_BASEMAP_PMTILES_URL is configured; otherwise the map falls back to raster
// OpenStreetMap so it still works out of the box with no tile data to host.
//
// PMTiles requires the `pmtiles://` protocol to be registered on maplibre-gl
// before a map using this style mounts (see Mapview.jsx).

import { layers, namedTheme } from 'protomaps-themes-base';

const env = import.meta.env;

const BASEMAP_PMTILES_URL = (env.VITE_BASEMAP_PMTILES_URL || '').trim();
const GLYPHS_URL =
    (env.VITE_GLYPHS_URL || '').trim() ||
    'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf';
const SPRITE_URL = (env.VITE_SPRITE_URL || '').trim();

// A simple raster style from an XYZ tile template.
function rasterStyle(id, tiles, attribution, maxzoom = 19) {
    return {
        version: 8,
        sources: {
            [id]: { type: 'raster', tiles: [tiles], tileSize: 256, attribution, maxzoom },
        },
        layers: [{ id, type: 'raster', source: id }],
    };
}

// The Protomaps vector basemap, sourced from a single .pmtiles archive served
// over HTTP range requests (locally from public/, in prod from DO Spaces).
function pmtilesVectorStyle() {
    const style = {
        version: 8,
        glyphs: GLYPHS_URL,
        sources: {
            protomaps: {
                type: 'vector',
                url: `pmtiles://${BASEMAP_PMTILES_URL}`,
                attribution:
                    '<a href="https://protomaps.com">Protomaps</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
            },
        },
        layers: layers('protomaps', namedTheme('light'), { lang: 'en' }),
    };
    if (SPRITE_URL) style.sprite = SPRITE_URL;
    return style;
}

// Basemap registry. The PMTiles vector entry only appears when a URL is set.
export const BASEMAPS = [
    ...(BASEMAP_PMTILES_URL ? [{ id: 'vector', label: 'Vector (PMTiles)' }] : []),
    { id: 'osm', label: 'OpenStreetMap' },
    { id: 'topo', label: 'OpenTopoMap' },
    { id: 'satellite', label: 'Satellite (ESRI)' },
];

export const DEFAULT_BASEMAP_ID = BASEMAP_PMTILES_URL ? 'vector' : 'osm';

export function buildMapStyle(basemapId = DEFAULT_BASEMAP_ID) {
    switch (basemapId) {
        case 'vector':
            return BASEMAP_PMTILES_URL ? pmtilesVectorStyle() : buildMapStyle('osm');
        case 'topo':
            return rasterStyle(
                'topo',
                'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
                '&copy; OpenTopoMap contributors',
                17,
            );
        case 'satellite':
            return rasterStyle(
                'satellite',
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                '&copy; ESRI',
            );
        case 'osm':
        default:
            return rasterStyle(
                'osm',
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                '&copy; OpenStreetMap contributors',
            );
    }
}
