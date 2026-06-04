import * as SecureStore from 'expo-secure-store';
import { StateStorage } from 'zustand/middleware';

// Zustand persist storage backed by expo-secure-store (good for auth tokens).
// SecureStore keys must be alphanumeric + ._-; the store name 'auth-storage' is fine.
export const secureStorage: StateStorage = {
  getItem: async (name) => (await SecureStore.getItemAsync(name)) ?? null,
  setItem: async (name, value) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name) => {
    await SecureStore.deleteItemAsync(name);
  },
};
