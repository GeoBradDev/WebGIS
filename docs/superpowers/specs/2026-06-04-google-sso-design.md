# Google SSO across backend, web, and mobile — design

## Context

The WebGIS template authenticates with **django-allauth headless** using the token-based **app
client** (`/_allauth/app/v1/auth/...` with an `X-Session-Token`). The web and mobile clients each
have email/password login + signup. `allauth.socialaccount` is already in `INSTALLED_APPS`
(allauth 65.18), but no social provider is configured and neither client has any Google sign-in
code.

This adds **"Sign in with Google"** to all three platforms, integrated with the existing
token-based auth so a Google login yields the same `X-Session-Token` session the clients already
use. No new session model and no cookie-based divergence.

## Decisions (locked with the user)

- **Flow:** allauth headless **app token flow** — each client obtains a Google credential natively
  and POSTs it to `/_allauth/app/v1/auth/provider/token`, receiving the usual session token.
- **Token type:** **`id_token`** (the secure choice). **Correction (after source inspection):** the
  allauth 65 Google provider's `views.py` does a *module-level* `import` of
  `allauth/socialaccount/internal/jwtkit.py`, which hard-imports `jwt` (PyJWT) and `cryptography`.
  So merely adding the Google provider to `INSTALLED_APPS` requires those two deps **regardless of
  whether a client sends an `access_token` or an `id_token`** — the access_token flow does *not*
  avoid them. Given the deps are unavoidable, `id_token` is strictly better: allauth verifies the
  JWT signature and **validates the audience (`aud`)**, whereas the access_token path only fetches
  userinfo and does **not** validate audience (any Google token from any client would be accepted).
  Therefore: **add `PyJWT` + `cryptography` to `requirements.txt`** and send `id_token`.
- **Mobile library:** **`expo-auth-session`** (+ `expo-crypto`).
- **Account linking:** **auto-link by verified email** (`SOCIALACCOUNT_EMAIL_AUTHENTICATION` +
  `..._AUTO_CONNECT`). Google emails are pre-verified, so a Google login attaches to an existing
  verified account with the same email.
- **Credential provisioning:** the user creates the Google Cloud OAuth clients (Web, iOS, Android).
  This design wires everything to read them from env and documents the Console steps; it does not
  create them.

## Architecture / data flow

```
Client obtains a Google id_token natively
   (web: GIS "Sign in with Google" credential; mobile: expo-auth-session)
        │
        ▼
POST /_allauth/app/v1/auth/provider/token
   { "provider": "google", "process": "login",
     "token": { "client_id": "<platform client id>", "id_token": "<google id_token JWT>" } }
        │   allauth verifies the JWT signature + audience,
        │   auto-links to / creates a verified-email account
        ▼
   { "meta": { "session_token": "..." }, "data": { "user": {...} } }
        │
        ▼
Client stores session_token exactly as it does for email/password login
   (web: useAuthStore + localStorage; mobile: useAuthStore + expo-secure-store)
```

## Backend (Django allauth)

`backend/WebGIS/settings.py`:
- Add `'allauth.socialaccount.providers.google'` to `INSTALLED_APPS`.
- Configure the provider from env, including only the apps whose client IDs are set:
  ```python
  _google_apps = []
  if os.getenv('GOOGLE_OAUTH_CLIENT_ID_WEB'):
      _google_apps.append({'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_WEB'),
                           'secret': os.getenv('GOOGLE_OAUTH_SECRET_WEB', ''), 'key': ''})
  if os.getenv('GOOGLE_OAUTH_CLIENT_ID_IOS'):
      _google_apps.append({'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_IOS'), 'secret': '', 'key': ''})
  if os.getenv('GOOGLE_OAUTH_CLIENT_ID_ANDROID'):
      _google_apps.append({'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_ANDROID'), 'secret': '', 'key': ''})

  SOCIALACCOUNT_PROVIDERS = {
      'google': {'APPS': _google_apps, 'SCOPE': ['profile', 'email'],
                 'AUTH_PARAMS': {'access_type': 'online'}},
  }
  SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
  SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
  ```
  The `provider/token` endpoint selects the matching app by the `client_id` the client sends.
- New env vars in `backend/.env.example`: `GOOGLE_OAUTH_CLIENT_ID_WEB`, `GOOGLE_OAUTH_SECRET_WEB`,
  `GOOGLE_OAUTH_CLIENT_ID_IOS`, `GOOGLE_OAUTH_CLIENT_ID_ANDROID` (all optional; the provider is a
  no-op until at least one is set).
- **No `requirements.txt` change. No DB `SocialApp`. No new migration** (settings-based `APPS`;
  `socialaccount` tables already exist).

## Web (React)

- Load Google Identity Services (`https://accounts.google.com/gsi/client`) via a small loader.
- `initGoogleSignIn(onCredential)`: `google.accounts.id.initialize({ client_id: VITE_GOOGLE_CLIENT_ID,
  callback })` + `renderButton`; the callback yields a `credential` (the id_token JWT).
- `src/store/useAuthStore.js`: new `loginWithGoogle(credential)` →
  `POST ${allAuthEndpoint}/provider/token` with `token:{client_id: VITE_GOOGLE_CLIENT_ID, id_token: credential}`
  → on success set `user` + `sessionToken` from the response, identical to the existing `login`.
- `Components/AuthForm.jsx`: a "Sign in with Google" button under the email/password form.
- `frontend/.env.example`: `VITE_GOOGLE_CLIENT_ID`.

## Mobile (Expo)

- Add `expo-auth-session` + `expo-crypto`. Use `expo-auth-session/providers/google`:
  `Google.useAuthRequest({ iosClientId, androidClientId, webClientId, scopes:['openid','profile','email'] })`
  (from `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS/_ANDROID/_WEB`). On `response.type === 'success'`, read
  `response.authentication.idToken`.
- `store/useAuthStore.ts`: new `loginWithGoogle(idToken)` → `POST` the same
  `provider/token` body → persist the session via the existing SecureStore path.
- `components/AuthForm.tsx`: a "Sign in with Google" button. The existing `webgisreactnative` URL
  scheme is the redirect target.
- `mobile/.env.example`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB/_IOS/_ANDROID`.

## Google Cloud setup (documented; user performs)

A doc section (in the platform READMEs / a `docs/` note) with exact steps:
1. Create/select a Google Cloud project; configure the OAuth consent screen (External; scopes
   `profile`, `email`; add test users while unverified).
2. Create three OAuth client IDs:
   - **Web** — authorized JavaScript origins (e.g. `http://localhost:5173`, the prod web origin).
   - **iOS** — bundle ID `com.brad.stricherz.WebGISReactNative` (adjust per fork).
   - **Android** — package name + SHA-1 of the signing key.
3. Put the client IDs (and the web secret) into each platform's `.env`.

## Security considerations

- **Resolved by choosing `id_token`.** Source inspection of the installed allauth confirmed the
  `access_token` path does **not** validate the token's audience (it just fetches userinfo and
  trusts it), so any Google access_token from any OAuth client could authenticate. The `id_token`
  path verifies the JWT signature against Google's certs and checks `aud` against the configured
  client IDs, closing that hole. This is why we send `id_token`.
- The web client secret is only configured for completeness; the `provider/token` path does no
  authorization-code exchange, so native (public) clients carry no secret.

## Error handling

- User closes/denies the Google consent popup → client surfaces a non-fatal message, no crash.
- `provider/token` returns non-2xx → client shows the error (web snackbar / mobile `Alert`).
- GIS script fails to load (web) → the Google button is disabled with a message.
- Provider not configured (no client IDs set) → the button can still render; the backend returns a
  clear 4xx, surfaced to the user. Document that Google login requires the env vars.

## Testing

- **Backend** (`api/tests.py`, pytest): a test that `POST /_allauth/app/v1/auth/provider/token`
  with `provider='google'` and a missing/invalid token credential returns a 4xx — proving the route is
  registered and the provider configured (requires a dummy `GOOGLE_OAUTH_CLIENT_ID_WEB` in the test
  env/settings). Optionally assert `google` appears in the configured providers. Full Google
  round-trips need real credentials → manual.
- **Web:** `npm run lint` + `npm run build` clean; the Google button renders. Real sign-in →
  manual (real Google account + browser).
- **Mobile:** `npm run type-check` + `npx jest` (existing 8 tests) still pass; the button renders.
  Real sign-in → manual (device + the Google clients).

## Implementation phasing (for the plan)

1. **Backend** — provider config + env + endpoint test.
2. **Web** — GIS loader/hook + `loginWithGoogle` + button.
3. **Mobile** — `expo-auth-session` + `loginWithGoogle` + button.
4. **Docs + verification** — Google Cloud Console steps in the READMEs; cross-platform manual
   verification checklist.

## Out of scope

- Refresh tokens / offline access (`access_type=offline`).
- A "connect Google to an already-signed-in account" UI (allauth `process=connect`); auto-link by
  email covers the same-email case.
- Other social providers (Apple, GitHub, etc.).
- Any change to the map/data/dashboard features.

## Note on process

Per the user's git policy, this spec is written but **not committed**. The Google credentials and
the live end-to-end OAuth round-trips are the user's to perform; this design builds and statically
verifies all wiring.
