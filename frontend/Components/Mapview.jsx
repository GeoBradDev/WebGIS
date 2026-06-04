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
                top: 100,
                left: 9,
                zIndex: 1000,
                width: '36px',
                height: '36px',
                padding: '4px',
                backgroundColor: 'white',
                border: 'grey 1px solid',
                '&:hover': { backgroundColor: '#f0f0f0' },
            }}
        >
            <HomeIcon />
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
                top: 145,
                left: 9,
                zIndex: 1000,
                width: '36px',
                height: '36px',
                padding: '4px',
                backgroundColor: 'white',
                border: 'grey 1px solid',
                '&:hover': { backgroundColor: '#f0f0f0' },
            }}
        >
            <GpsFixedIcon />
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

                {popupInfo?.config?.popup && (
                    <Popup
                        longitude={popupInfo.longitude}
                        latitude={popupInfo.latitude}
                        anchor="bottom"
                        onClose={() => setPopupInfo(null)}
                        closeOnClick={false}
                    >
                        <div style={{ fontFamily: 'Arial, sans-serif' }}>
                            <h4 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>
                                {popupInfo.properties[popupInfo.config.popup.titleField] || 'N/A'}
                            </h4>
                            {popupInfo.config.popup.rows.map((row) => (
                                <p key={row.field} style={{ margin: '4px 0' }}>
                                    <strong>{row.label}:</strong>{' '}
                                    {formatPopupValue(popupInfo.properties[row.field], row.format)}
                                </p>
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
