import { useEffect, useMemo, useState } from 'react';
import Map, {
    Source,
    Layer,
    Marker,
    Popup,
    NavigationControl,
    useMap,
} from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import PropTypes from 'prop-types';
import 'maplibre-gl/dist/maplibre-gl.css';
import '../src/App.css';
import { Box, IconButton, ToggleButtonGroup, ToggleButton } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import useStore from '../src/store/useStore';
import { buildMapStyle, BASEMAPS } from '../src/mapStyle';
import { PRIMARY_LAYER, LAYER_CONFIGS, formatPopupValue } from '../src/layers';
import { tokens, mono } from '../src/theme';
import CollapsibleTable from './CollapsableTable.jsx';

// Register the pmtiles:// protocol once, at module load. Doing this at module
// scope (rather than in an effect) guarantees a single registration even under
// React 19 StrictMode double-invocation.
const protocol = new Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// maplibre-gl works in [lng, lat]; the store keeps the Leaflet [lat, lng]
// convention, so we convert only here at the map boundary.

// Per-layer fill/line ids follow this convention so click handling can map a
// clicked feature back to its layer config.
const fillLayerId = (layerId) => `${layerId}-fill`;

// Render one registry layer (a line outline + a clickable fill) from its style.
function LayerSource({ layer, data }) {
    const { style } = layer;
    return (
        <Source id={layer.id} type="geojson" data={data}>
            <Layer
                id={`${layer.id}-line`}
                type="line"
                paint={{ 'line-color': style.lineColor, 'line-width': style.lineWidth ?? 2 }}
            />
            <Layer
                id={fillLayerId(layer.id)}
                type="fill"
                paint={{ 'fill-color': style.fillColor, 'fill-opacity': style.fillOpacity ?? 0.1 }}
            />
        </Source>
    );
}

LayerSource.propTypes = {
    layer: PropTypes.object.isRequired,
    data: PropTypes.object,
};

function MapUpdater() {
    const { current: map } = useMap();
    const mapCenter = useStore((state) => state.mapCenter);

    useEffect(() => {
        if (map && mapCenter) {
            map.flyTo({ center: [mapCenter[1], mapCenter[0]] });
        }
    }, [map, mapCenter]);

    return null;
}

function BoundsUpdater() {
    const { current: map } = useMap();
    const bounds = useStore((state) => state.bounds);

    useEffect(() => {
        if (map && bounds) {
            // Sidebar sets Leaflet-order [[south, west], [north, east]];
            // maplibre wants [[west, south], [east, north]].
            const [[south, west], [north, east]] = bounds;
            map.fitBounds([[west, south], [east, north]], { padding: 40 });
        }
    }, [map, bounds]);

    return null;
}

function HomeButton() {
    const { current: map } = useMap();
    const defaultCenter = useStore((state) => state.defaultCenter);

    const handleHomeClick = () => {
        if (map) map.flyTo({ center: [defaultCenter[1], defaultCenter[0]], zoom: 11 });
    };

    return (
        <IconButton
            onClick={handleHomeClick}
            sx={{
                position: 'absolute',
                top: 102,
                left: 10,
                zIndex: 1000,
                width: 34,
                height: 34,
                borderRadius: 2,
                color: 'primary.main',
                backgroundColor: 'background.paper',
                border: `1px solid ${tokens.hairline}`,
                boxShadow: '0 2px 8px rgba(20,24,38,0.12)',
                '&:hover': { backgroundColor: tokens.accentSoft, color: 'secondary.main' },
            }}
        >
            <HomeIcon fontSize="small" />
        </IconButton>
    );
}

function GpsButton() {
    const { current: map } = useMap();
    const setUserLocation = useStore((state) => state.setUserLocation);

    const handleGpsClick = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    if (map) map.flyTo({ center: [longitude, latitude], zoom: 14 });
                    setUserLocation([latitude, longitude]);
                },
                (error) => {
                    console.error('Error fetching GPS location:', error);
                    alert('Unable to retrieve your location.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser.');
        }
    };

    return (
        <IconButton
            onClick={handleGpsClick}
            sx={{
                position: 'absolute',
                top: 144,
                left: 10,
                zIndex: 1000,
                width: 34,
                height: 34,
                borderRadius: 2,
                color: 'primary.main',
                backgroundColor: 'background.paper',
                border: `1px solid ${tokens.hairline}`,
                boxShadow: '0 2px 8px rgba(20,24,38,0.12)',
                '&:hover': { backgroundColor: tokens.accentSoft, color: 'secondary.main' },
            }}
        >
            <GpsFixedIcon fontSize="small" />
        </IconButton>
    );
}

function BasemapSwitcher() {
    const activeBasemap = useStore((state) => state.activeBasemap);
    const setActiveBasemap = useStore((state) => state.setActiveBasemap);

    return (
        <ToggleButtonGroup
            size="small"
            exclusive
            value={activeBasemap}
            onChange={(_, value) => value && setActiveBasemap(value)}
            sx={{
                position: 'absolute',
                top: 9,
                right: 9,
                zIndex: 1001,
                backgroundColor: 'white',
                boxShadow: 1,
                flexWrap: 'wrap',
            }}
        >
            {BASEMAPS.map((b) => (
                <ToggleButton key={b.id} value={b.id} sx={{ textTransform: 'none' }}>
                    {b.label}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

function MapView() {
    const mapCenter = useStore((state) => state.mapCenter);
    const userLocation = useStore((state) => state.userLocation);
    const isDataLoaded = useStore((state) => state.isDataLoaded);
    const fetchLayers = useStore((state) => state.fetchLayers);
    const layers = useStore((state) => state.layers);
    const getFilteredPrimaryData = useStore((state) => state.getFilteredPrimaryData);
    const geojsonData = useStore((state) => state.geojsonData);
    const filters = useStore((state) => state.filters);
    const activeBasemap = useStore((state) => state.activeBasemap);
    const selectedFeatureId = useStore((state) => state.selectedFeatureId);

    const [popupInfo, setPopupInfo] = useState(null);

    // Fetch every configured layer's data on mount.
    useEffect(() => {
        fetchLayers();
    }, [fetchLayers]);

    // Rebuild the style only when the chosen basemap changes.
    const mapStyle = useMemo(() => buildMapStyle(activeBasemap), [activeBasemap]);

    // Primary layer gets client-side filtering; recompute on data/filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const filteredPrimary = useMemo(() => getFilteredPrimaryData(), [geojsonData, filters]);

    // Every visible layer that has data; the primary layer renders filtered.
    const visibleLayers = Object.values(layers).filter((l) => l.visible && l.data);
    const primaryLayerState = layers[PRIMARY_LAYER.id];
    const primaryVisible = Boolean(primaryLayerState?.visible && primaryLayerState?.data);
    const dataForLayer = (layer) =>
        layer.id === PRIMARY_LAYER.id ? filteredPrimary : layer.data;
    const interactiveLayerIds = visibleLayers.map((l) => fillLayerId(l.id));

    const handleMapClick = (event) => {
        const feature = event.features?.[0];
        if (!feature) {
            setPopupInfo(null);
            return;
        }
        const layerId = feature.layer?.id?.replace(/-fill$/, '');
        const config = LAYER_CONFIGS.find((c) => c.id === layerId);
        setPopupInfo({
            longitude: event.lngLat.lng,
            latitude: event.lngLat.lat,
            properties: feature.properties,
            config,
        });
    };

    return (
        <Box sx={{ flex: 1, position: 'relative' }}>
            <Map
                initialViewState={{
                    longitude: mapCenter[1],
                    latitude: mapCenter[0],
                    zoom: 11,
                }}
                mapStyle={mapStyle}
                style={{ width: '100%', height: '100%' }}
                interactiveLayerIds={interactiveLayerIds}
                onClick={handleMapClick}
            >
                <NavigationControl position="top-left" showCompass={false} />
                <MapUpdater />
                <BoundsUpdater />
                <HomeButton />
                <GpsButton />

                {userLocation && (
                    <Marker longitude={userLocation[1]} latitude={userLocation[0]}>
                        <div className="gps-marker" />
                    </Marker>
                )}

                {/* Render every visible registry layer (configured in src/layers.js). */}
                {visibleLayers.map((layer) => (
                    <LayerSource key={layer.id} layer={layer} data={dataForLayer(layer)} />
                ))}

                {/* Coral highlight outline for the feature selected in the result rail. */}
                {primaryVisible && selectedFeatureId != null && (
                    <Layer
                        id="primary-highlight"
                        source={PRIMARY_LAYER.id}
                        type="line"
                        filter={['==', ['get', PRIMARY_LAYER.idField], selectedFeatureId]}
                        paint={{ 'line-color': tokens.amber, 'line-width': 3.5, 'line-opacity': 1 }}
                    />
                )}

                {popupInfo?.config?.popup && (
                    <Popup
                        longitude={popupInfo.longitude}
                        latitude={popupInfo.latitude}
                        anchor="bottom"
                        onClose={() => setPopupInfo(null)}
                        closeOnClick={false}
                        maxWidth="260px"
                    >
                        <div>
                            <div style={{ fontFamily: '"IBM Plex Sans", sans-serif', fontWeight: 600, fontSize: 14, color: tokens.ink, marginBottom: 8 }}>
                                {popupInfo.properties[popupInfo.config.popup.titleField] || 'N/A'}
                            </div>
                            {popupInfo.config.popup.rows.map((row) => (
                                <div key={row.field} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12.5, padding: '3px 0', borderTop: `1px solid ${tokens.hairline}` }}>
                                    <span style={{ color: tokens.slate }}>{row.label}</span>
                                    <span style={{ fontFamily: mono, color: tokens.ink, fontWeight: 500 }}>
                                        {formatPopupValue(popupInfo.properties[row.field], row.format)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Popup>
                )}
            </Map>

            <BasemapSwitcher />

            {/* Render CollapsibleTable only if data is loaded */}
            {isDataLoaded && <CollapsibleTable />}
        </Box>
    );
}

export default MapView;
