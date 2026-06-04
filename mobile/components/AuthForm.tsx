import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';

export default function AuthForm() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [busy, setBusy] = useState(false);

  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);

  const submit = async () => {
    setBusy(true);
    const res =
      mode === 'login'
        ? await login(email, password)
        : await signup({ email, password, first_name: firstName, last_name: lastName });
    setBusy(false);
    if (res.verificationPending) {
      Alert.alert('Check your email', res.message ?? 'Verification email sent. Verify on the web, then sign in here.');
      setMode('login');
    } else if (!res.success) {
      Alert.alert(mode === 'login' ? 'Login' : 'Sign up', res.message ?? 'Failed');
    }
  };

  return (
    <View style={styles.form}>
      <Text style={styles.title}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
      {mode === 'signup' && (
        <>
          <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} />
          <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} />
        </>
      )}
      <TouchableOpacity style={styles.button} onPress={submit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '...' : mode === 'login' ? 'Sign in' : 'Sign up'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')}>
        <Text style={styles.switch}>
          {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { padding: 20, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12 },
  button: { backgroundColor: '#1976d2', borderRadius: 6, padding: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
  switch: { color: '#1976d2', textAlign: 'center', marginTop: 8 },
});
