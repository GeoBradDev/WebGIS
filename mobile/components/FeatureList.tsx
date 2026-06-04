import { useMemo } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';
import { filterFeatures } from '@/lib/filters';

export default function FeatureList({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // Subscribe to the reactive state (data + filters) so the list re-renders
  // when either changes, rather than reading the stable selector function once.
  const data = useLayerStore((s) => s.layers[PRIMARY_LAYER.id]?.data ?? null);
  const filters = useLayerStore((s) => s.filters);
  const features = useMemo(
    () => filterFeatures(data, PRIMARY_LAYER, filters).features,
    [data, filters],
  );
  const columns = PRIMARY_LAYER.columns ?? [];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Features ({features.length})</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={features}
          keyExtractor={(f, i) => String(f.properties?.[PRIMARY_LAYER.idField ?? ''] ?? f.id ?? i)}
          ListEmptyComponent={<Text style={styles.empty}>No features.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {columns.map((c) => (
                <Text key={c.field} style={styles.cell}>
                  <Text style={styles.cellLabel}>{c.headerName}: </Text>
                  {String(item.properties?.[c.field] ?? '')}
                </Text>
              ))}
            </View>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700' },
  close: { color: '#1976d2', fontWeight: '600', fontSize: 16 },
  row: { padding: 14, borderBottomWidth: 1, borderColor: '#f0f0f0' },
  cell: { marginVertical: 1 },
  cellLabel: { fontWeight: '600' },
  empty: { padding: 24, textAlign: 'center', color: '#666' },
});
