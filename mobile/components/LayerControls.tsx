import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';

export default function LayerControls({
  onOpenFilters,
  onOpenList,
}: {
  onOpenFilters: () => void;
  onOpenList: () => void;
}) {
  const [open, setOpen] = useState(false);
  const layers = useLayerStore((s) => s.layers);
  const toggle = useLayerStore((s) => s.toggleLayerVisibility);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.fab} onPress={() => setOpen((o) => !o)}>
        <Text style={styles.fabText}>{open ? '✕' : '☰'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.panel}>
          <Text style={styles.heading}>Layers</Text>
          {Object.values(layers).map((l) => (
            <TouchableOpacity key={l.id} style={styles.layerRow} onPress={() => toggle(l.id)}>
              <View style={[styles.swatch, { backgroundColor: l.style.fillColor, borderColor: l.style.lineColor }]} />
              <Text style={styles.layerName}>{l.visible ? '☑' : '☐'} {l.name}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={onOpenFilters}>
              <Text style={styles.actionText}>Filters</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={onOpenList}>
              <Text style={styles.actionText}>List</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 10, top: 64, alignItems: 'flex-end' },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1976d2', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  fabText: { color: 'white', fontSize: 20 },
  panel: { marginTop: 8, backgroundColor: 'white', borderRadius: 10, padding: 12, width: 230, elevation: 4 },
  heading: { fontWeight: '700', marginBottom: 8 },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  swatch: { width: 22, height: 14, borderRadius: 3, borderWidth: 2 },
  layerName: { flexShrink: 1 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  action: { flex: 1, backgroundColor: '#eee', borderRadius: 6, paddingVertical: 8, alignItems: 'center' },
  actionText: { fontWeight: '600' },
});
