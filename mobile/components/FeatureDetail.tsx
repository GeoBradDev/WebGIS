import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LayerConfig, formatPopupValue } from '../config/layers';

export type SelectedFeature = { layer: LayerConfig; properties: Record<string, any> };

export default function FeatureDetail({
  selected,
  onClose,
}: {
  selected: SelectedFeature | null;
  onClose: () => void;
}) {
  if (!selected?.layer.popup) return null;
  const { titleField, rows } = selected.layer.popup;
  const props = selected.properties || {};
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{props[titleField] ?? 'N/A'}</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>
      {rows.map((r) => (
        <Text key={r.field} style={styles.row}>
          <Text style={styles.label}>{r.label}: </Text>
          {formatPopupValue(props[r.field], r.format)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', left: 10, right: 10, bottom: 10, backgroundColor: 'white', borderRadius: 10, padding: 14, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: '#1976d2' },
  close: { fontSize: 18, color: '#666', paddingHorizontal: 8 },
  row: { marginVertical: 2 },
  label: { fontWeight: '600' },
});
