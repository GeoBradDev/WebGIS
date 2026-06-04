import { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useAuthStore } from '@/store/useAuthStore';

// Required so the auth popup can close and return control to the app.
WebBrowser.maybeCompleteAuthSession();

export default function GoogleSignInButton() {
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
    scopes: ['openid', 'profile', 'email'], // openid -> Google returns an id_token
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken =
        response.authentication?.idToken ?? (response.params as any)?.id_token;
      if (idToken) {
        loginWithGoogle(idToken).then((r) => {
          if (!r.success) Alert.alert('Google sign-in', r.message ?? 'Failed');
        });
      } else {
        Alert.alert('Google sign-in', 'No id_token returned.');
      }
    } else if (response?.type === 'error') {
      Alert.alert('Google sign-in', 'Authentication failed.');
    }
  }, [response, loginWithGoogle]);

  return (
    <TouchableOpacity style={styles.button} disabled={!request} onPress={() => promptAsync()}>
      <Text style={styles.text}>Sign in with Google</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { borderWidth: 1, borderColor: '#1976d2', borderRadius: 6, padding: 14, alignItems: 'center' },
  text: { color: '#1976d2', fontWeight: '600' },
});
