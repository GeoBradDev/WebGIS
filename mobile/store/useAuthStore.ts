import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Platform } from 'react-native';
import { ALLAUTH_ENDPOINT } from '../config/api';
import { secureStorage } from './secureStorage';

type AuthResult = { success: boolean; message?: string; verificationPending?: boolean };

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  sessionToken: string | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: (idToken: string) => Promise<AuthResult>;
  signup: (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => Promise<AuthResult>;
  logout: () => Promise<AuthResult>;
  fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      sessionToken: null,

      login: async (email, password) => {
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.user, isAuthenticated: true, sessionToken: data.meta.session_token });
            return { success: true, message: 'Login successful!' };
          }
          return { success: false, message: data.error || 'Invalid credentials' };
        } catch {
          return { success: false, message: 'Server error. Please try again later.' };
        }
      },

      loginWithGoogle: async (idToken) => {
        // allauth validates the id_token's `aud` against the configured client
        // IDs, so send the platform's client id (the one the token was minted
        // for). All three are registered in the backend's google APPS.
        const clientId =
          Platform.select({
            ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
            android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
            default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
          }) ??
          process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ??
          '';
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/provider/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: 'google',
              process: 'login',
              token: { client_id: clientId, id_token: idToken },
            }),
          });
          const data = await res.json();
          if (res.ok) {
            set({ user: data.data?.user ?? data.user, isAuthenticated: true, sessionToken: data.meta?.session_token });
            return { success: true, message: 'Login successful!' };
          }
          return { success: false, message: data.error || 'Google login failed' };
        } catch {
          return { success: false, message: 'Server error. Please try again later.' };
        }
      },

      signup: async ({ email, password, first_name, last_name }) => {
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username: email, password, first_name, last_name }),
          });
          const data = await res.json();
          if (res.status === 401 && data.data?.flows) {
            const pending = data.data.flows.find(
              (f: any) => f.id === 'verify_email' && f.is_pending,
            );
            if (pending) {
              return {
                success: false,
                verificationPending: true,
                message: 'A verification email has been sent. Verify on the web, then log in here.',
              };
            }
          }
          return { success: false, message: data.error || 'Signup failed' };
        } catch {
          return { success: false, message: 'Server error. Please try again later.' };
        }
      },

      logout: async () => {
        const token = get().sessionToken;
        if (!token) {
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: true };
        }
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/session`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          });
          // allauth returns 401 once the session is gone.
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: res.status === 401 || res.ok };
        } catch {
          set({ user: null, isAuthenticated: false, sessionToken: null });
          return { success: false, message: 'Server error, but session cleared locally.' };
        }
      },

      fetchUser: async () => {
        const token = get().sessionToken;
        if (!token) return;
        try {
          const res = await fetch(`${ALLAUTH_ENDPOINT}/session`, {
            headers: { 'Content-Type': 'application/json', 'X-Session-Token': token },
          });
          const result = await res.json();
          if (result?.data?.user) {
            set({ user: result.data.user, isAuthenticated: true });
          } else {
            set({ user: null, isAuthenticated: false, sessionToken: null });
          }
        } catch {
          // keep persisted token; user can retry
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (s) => ({ sessionToken: s.sessionToken, user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);
