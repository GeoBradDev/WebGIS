import { useMemo } from 'react';
import { ScrollView, View, Text, Dimensions, StyleSheet } from 'react-native';
import { BarChart, PieChart } from 'react-native-chart-kit';
import { useLayerStore } from '@/store/useLayerStore';
import { PRIMARY_LAYER } from '@/config/layers';
import { filterFeatures } from '@/lib/filters';

const width = Dimensions.get('window').width - 24;
const chartConfig = {
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  color: (o = 1) => `rgba(25, 118, 210, ${o})`,
  labelColor: () => '#333',
  decimalPlaces: 1,
};
const PIE_COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

export default function DashboardScreen() {
  // Subscribe to data + filters so charts update when layer data loads or
  // filters change (reading the stable selector once would never re-render).
  const data = useLayerStore((s) => s.layers[PRIMARY_LAYER.id]?.data ?? null);
  const filters = useLayerStore((s) => s.filters);
  const features = useMemo(
    () => filterFeatures(data, PRIMARY_LAYER, filters).features,
    [data, filters],
  );

  const dash = PRIMARY_LAYER.dashboard;
  if (!dash) {
    return (
      <View style={styles.center}>
        <Text>No dashboard is configured for the primary layer.</Text>
      </View>
    );
  }
  const { categoryField, valueField, valueLabel } = dash;

  const rows = features
    .map((f) => ({ name: String(f.properties?.[categoryField] ?? ''), value: Number(f.properties?.[valueField] ?? 0) }))
    .filter((r) => Number.isFinite(r.value));
  const top = [...rows].sort((a, b) => b.value - a.value).slice(0, 6);

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Text>No data loaded yet. Open the Map tab first.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 12 }}>
      <Text style={styles.h1}>GIS Dashboard</Text>
      <Text style={styles.h2}>{valueLabel} — top {top.length}</Text>
      <BarChart
        data={{ labels: top.map((r) => r.name.slice(0, 6)), datasets: [{ data: top.map((r) => r.value) }] }}
        width={width}
        height={240}
        yAxisLabel=""
        yAxisSuffix=""
        chartConfig={chartConfig}
        verticalLabelRotation={30}
        fromZero
      />
      <Text style={styles.h2}>Distribution</Text>
      <PieChart
        data={top.map((r, i) => ({ name: r.name.slice(0, 8), population: r.value, color: PIE_COLORS[i % PIE_COLORS.length], legendFontColor: '#333', legendFontSize: 12 }))}
        width={width}
        height={220}
        accessor="population"
        backgroundColor="transparent"
        paddingLeft="8"
        chartConfig={chartConfig as any}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '600', marginTop: 18, marginBottom: 8 },
});
