// Base URL of the Django API and the derived django-allauth headless origin.
// EXPO_PUBLIC_* vars are inlined at build time. On a physical device, set
// EXPO_PUBLIC_API_URL to your dev machine's LAN IP (localhost won't resolve).
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

// allauth lives at the site root (sibling of /api); strip a trailing /api.
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export const ALLAUTH_ENDPOINT = `${API_ORIGIN}/_allauth/app/v1/auth`;
