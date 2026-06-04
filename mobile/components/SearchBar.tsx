import { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';

export type SearchResult = { latitude: number; longitude: number };

export default function SearchBar({ onResult }: { onResult: (r: SearchResult) => void }) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}`,
        { headers: { 'User-Agent': 'webgis-mobile-template' } },
      );
      const results = await res.json();
      if (results.length > 0) {
        onResult({ latitude: parseFloat(results[0].lat), longitude: parseFloat(results[0].lon) });
      } else {
        Alert.alert('Not found', 'No location matched your search.');
      }
    } catch {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.input}
        placeholder="Search location"
        value={text}
        onChangeText={setText}
        onSubmitEditing={search}
        returnKeyType="search"
      />
      <TouchableOpacity style={styles.button} onPress={search} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? '...' : 'Go'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, backgroundColor: 'white', borderRadius: 6, paddingHorizontal: 10, height: 40, borderWidth: 1, borderColor: '#ccc' },
  button: { backgroundColor: '#1976d2', borderRadius: 6, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
});
