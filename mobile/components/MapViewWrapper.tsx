import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { UrlTile, Geojson, Region } from 'react-native-maps';
import useLocation from '@/hooks/useLocation';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER, LayerConfig } from '@/config/layers';
import SearchBar from './SearchBar';
import FeatureDetail, { SelectedFeature } from './FeatureDetail';

const DEFAULT_REGION: Region = {
  latitude: 38.64,
  longitude: -90.3,
  latitudeDelta: 0.4,
  longitudeDelta: 0.4,
};

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export default function MapViewWrapper({ controls }: { controls?: React.ReactNode }) {
  const mapRef = useRef<MapView>(null);
  const layers = useLayerStore((s) => s.layers);
  const fetchLayers = useLayerStore((s) => s.fetchLayers);
  const getFilteredPrimaryData = useLayerStore((s) => s.getFilteredPrimaryData);
  const filters = useLayerStore((s) => s.filters);
  const location = useLocation();
  const [selected, setSelected] = useState<SelectedFeature | null>(null);

  useEffect(() => {
    fetchLayers();
  }, [fetchLayers]);

  const visibleLayers = Object.values(layers).filter((l) => l.visible && l.data);
  const dataForLayer = (l: LayerConfig & { data: any }) =>
    l.id === PRIMARY_LAYER.id ? getFilteredPrimaryData() : l.data;

  const goHome = () => mapRef.current?.animateToRegion(DEFAULT_REGION, 500);
  const goToMe = () =>
    location &&
    mapRef.current?.animateToRegion(
      { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
      500,
    );

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={DEFAULT_REGION} showsUserLocation>
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        {visibleLayers.map((l) => {
          const fc = dataForLayer(l);
          if (!fc) return null;
          return (
            <Geojson
              key={`${l.id}-${filters.rangeMin}-${filters.rangeMax}-${JSON.stringify(filters.categorical)}`}
              geojson={fc as any}
              strokeColor={l.style.lineColor}
              fillColor={rgba(l.style.fillColor, l.style.fillOpacity ?? 0.1)}
              strokeWidth={l.style.lineWidth ?? 2}
              tappable
              onPress={(e: any) => setSelected({ layer: l, properties: e?.feature?.properties ?? {} })}
            />
          );
        })}
      </MapView>

      <View style={styles.topBar}>
        <SearchBar onResult={(r) => mapRef.current?.animateToRegion({ ...r, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500)} />
      </View>

      <View style={styles.sideButtons}>
        <TouchableOpacity style={styles.iconButton} onPress={goHome}>
          <Text style={styles.icon}>⌂</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconButton} onPress={goToMe}>
          <Text style={styles.icon}>◎</Text>
        </TouchableOpacity>
      </View>

      {controls}
      <FeatureDetail selected={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  topBar: { position: 'absolute', top: 10, left: 10, right: 10 },
  sideButtons: { position: 'absolute', top: 64, left: 10, gap: 8 },
  iconButton: { width: 40, height: 40, borderRadius: 6, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#ccc' },
  icon: { fontSize: 20 },
});
