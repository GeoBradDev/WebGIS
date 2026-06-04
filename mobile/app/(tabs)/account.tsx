import { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import AuthForm from '@/components/AuthForm';

export default function AccountScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fetchUser = useAuthStore((s) => s.fetchUser);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (!isAuthenticated) return <AuthForm />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signed in</Text>
      <Text style={styles.email}>{user?.email ?? user?.username ?? ''}</Text>
      <TouchableOpacity style={styles.button} onPress={logout}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  title: { fontSize: 20, fontWeight: '700' },
  email: { color: '#555' },
  button: { backgroundColor: '#d32f2f', borderRadius: 6, paddingVertical: 12, paddingHorizontal: 24 },
  buttonText: { color: 'white', fontWeight: '600' },
});
