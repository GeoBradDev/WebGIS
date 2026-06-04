import { Modal, View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';

export default function FiltersModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const filters = useLayerStore((s) => s.filters);
  const setCategorical = useLayerStore((s) => s.setCategoricalFilter);
  const setRange = useLayerStore((s) => s.setRange);
  const reset = useLayerStore((s) => s.resetFilters);
  const getUniqueValues = useLayerStore((s) => s.getUniqueValues);

  const toggleValue = (field: string, value: string | number) => {
    const current = filters.categorical[field] || [];
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    setCategorical(field, next);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.close}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {(PRIMARY_LAYER.categoricalFilters || []).map((f) => (
            <View key={f.field} style={{ marginBottom: 18 }}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.chips}>
                {getUniqueValues(f.field).map((v) => {
                  const active = (filters.categorical[f.field] || []).includes(v);
                  return (
                    <TouchableOpacity
                      key={String(v)}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => toggleValue(f.field, v)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{String(v)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {PRIMARY_LAYER.rangeFilter && (
            <View>
              <Text style={styles.label}>{PRIMARY_LAYER.rangeFilter.label}</Text>
              <View style={styles.rangeRow}>
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Min"
                  keyboardType="numeric"
                  value={filters.rangeMin}
                  onChangeText={(t) => setRange('rangeMin', t)}
                />
                <TextInput
                  style={styles.rangeInput}
                  placeholder="Max"
                  keyboardType="numeric"
                  value={filters.rangeMax}
                  onChangeText={(t) => setRange('rangeMax', t)}
                />
              </View>
            </View>
          )}
          <TouchableOpacity style={styles.resetBtn} onPress={reset}>
            <Text style={styles.resetText}>Reset filters</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700' },
  close: { color: '#1976d2', fontWeight: '600', fontSize: 16 },
  label: { fontWeight: '600', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#bbb', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1976d2', borderColor: '#1976d2' },
  chipText: { color: '#333' },
  chipTextActive: { color: 'white' },
  rangeRow: { flexDirection: 'row', gap: 12 },
  rangeInput: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10 },
  resetBtn: { marginTop: 24, backgroundColor: '#eee', borderRadius: 6, padding: 12, alignItems: 'center' },
  resetText: { fontWeight: '600' },
});
