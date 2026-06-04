# Google SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **GIT POLICY (user override):** Do NOT run `git commit` or `git push`. Where this plan says "Checkpoint", run the listed checks and pause for the user to review; the user commits manually.

**Goal:** Add "Sign in with Google" to the backend, web, and mobile clients using allauth's headless app token flow with a Google `id_token` (secure: allauth validates the JWT audience).

**Architecture:** Each client obtains a Google `id_token` natively (web: Google Identity Services "Sign in with Google" credential; mobile: expo-auth-session) and POSTs it to `/_allauth/app/v1/auth/provider/token`. allauth verifies the JWT signature + audience, auto-links to a verified-email account, and returns the same `X-Session-Token` session the clients already use. **Dependency note:** the allauth Google provider module-imports `jwtkit`, so `PyJWT` + `cryptography` are added to `requirements.txt` (required regardless of token type; the access_token flow does NOT avoid them and does not validate audience).

**Tech Stack:** django-allauth 65 (socialaccount/google, headless), Google Identity Services (web), expo-auth-session + expo-crypto (mobile), Zustand stores, MUI / React Native.

---

## File structure

Backend:
- Modify `backend/WebGIS/settings.py` — google provider config + auto-link settings (from env).
- Modify `backend/.env.example` — Google client-ID vars.
- Modify `backend/api/tests.py` — provider/token endpoint test.

Web:
- Create `frontend/src/googleSignIn.js` — GIS loader + `requestGoogleAccessToken()`.
- Create `frontend/Components/GoogleSignInButton.jsx` — the button.
- Modify `frontend/src/store/useAuthStore.js` — `loginWithGoogle(accessToken)`.
- Modify `frontend/Components/AuthForm.jsx` — render the button (new `onGoogleLogin` prop).
- Modify `frontend/src/App.jsx` — `handleGoogleLogin` + pass `onGoogleLogin`.
- Modify `frontend/.env.example` — `VITE_GOOGLE_CLIENT_ID`.

Mobile:
- Modify `mobile/package.json` — add `expo-auth-session`, `expo-crypto`.
- Create `mobile/components/GoogleSignInButton.tsx` — the button.
- Modify `mobile/store/useAuthStore.ts` — `loginWithGoogle(accessToken)`.
- Modify `mobile/components/AuthForm.tsx` — render the button.
- Modify `mobile/.env.example` — `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB/_IOS/_ANDROID`.

Docs:
- Modify root `README.md` — "Google Sign-In (SSO)" setup section.

---

# Phase 1 — Backend

### Task 1: Configure the Google provider + auto-linking

**Files:**
- Modify: `backend/WebGIS/settings.py`

- [ ] **Step 1: Add the google provider app to `INSTALLED_APPS`**

In `backend/WebGIS/settings.py`, change the allauth socialaccount line:
```python
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
```

- [ ] **Step 2: Add the provider config + auto-link settings**

Add this block right after the allauth settings (e.g. after the `HEADLESS_FRONTEND_URLS = {...}` block):
```python
# ── Social auth (Google) ──────────────────────────────────────────────────────
# Client IDs come from env; the provider is inert until at least one is set.
# Native (iOS/Android) clients are public, so they carry no secret. The headless
# app `provider/token` endpoint selects the matching app by the client_id the
# client sends, then verifies the Google access_token by fetching userinfo.
_GOOGLE_APPS = []
if os.getenv('GOOGLE_OAUTH_CLIENT_ID_WEB'):
    _GOOGLE_APPS.append({
        'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_WEB'),
        'secret': os.getenv('GOOGLE_OAUTH_SECRET_WEB', ''),
        'key': '',
    })
if os.getenv('GOOGLE_OAUTH_CLIENT_ID_IOS'):
    _GOOGLE_APPS.append({'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_IOS'), 'secret': '', 'key': ''})
if os.getenv('GOOGLE_OAUTH_CLIENT_ID_ANDROID'):
    _GOOGLE_APPS.append({'client_id': os.getenv('GOOGLE_OAUTH_CLIENT_ID_ANDROID'), 'secret': '', 'key': ''})

SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APPS': _GOOGLE_APPS,
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
    },
}

# Auto-link a Google login to an existing account with the same verified email
# (Google emails are pre-verified), so users keep a single account.
SOCIALACCOUNT_EMAIL_AUTHENTICATION = True
SOCIALACCOUNT_EMAIL_AUTHENTICATION_AUTO_CONNECT = True
```

- [ ] **Step 3: Verify Django still boots**

Run (from `backend/`, or via docker): `python manage.py check`
Expected: "System check identified no issues". (No new migration: settings-based `APPS`.)

- [ ] **Step 4: Checkpoint** — `manage.py check` clean. Pause for review.

---

### Task 2: Backend env example

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Append the Google vars**

Add to `backend/.env.example` (under a new section near the email block):
```bash
# ── Google SSO (optional) ─────────────────────────────────────────────────────
# OAuth client IDs from Google Cloud Console (see README "Google Sign-In").
# The Google login is inert until at least the web client ID is set.
GOOGLE_OAUTH_CLIENT_ID_WEB=
GOOGLE_OAUTH_SECRET_WEB=
GOOGLE_OAUTH_CLIENT_ID_IOS=
GOOGLE_OAUTH_CLIENT_ID_ANDROID=
```

- [ ] **Step 2: Checkpoint** — file saved.

---

### Task 3: Backend endpoint test (TDD)

**Files:**
- Modify: `backend/api/tests.py`

- [ ] **Step 1: Write the test**

Add the import near the top of `backend/api/tests.py` (with the other imports):
```python
from django.test import override_settings
```

Append this test:
```python
@override_settings(
    SOCIALACCOUNT_PROVIDERS={
        'google': {'APPS': [{'client_id': 'dummy.apps.googleusercontent.com', 'secret': '', 'key': ''}]}
    }
)
def test_google_provider_token_endpoint_is_wired(client):
    # The headless provider/token route must exist and validate input. A token
    # object with no access_token/id_token is rejected before any Google network
    # call, so this is deterministic and offline.
    resp = client.post(
        '/_allauth/app/v1/auth/provider/token',
        data=json.dumps({
            'provider': 'google',
            'process': 'login',
            'token': {'client_id': 'dummy.apps.googleusercontent.com'},
        }),
        content_type='application/json',
    )
    assert 400 <= resp.status_code < 500
```

- [ ] **Step 2: Run it**

Run (in the backend container, with the PostGIS db up — same as the existing suite):
`pytest api/tests.py::test_google_provider_token_endpoint_is_wired -q`
Expected: PASS (the route returns a 4xx for the missing credential).

If it 404s, the google provider app is not in `INSTALLED_APPS` (re-check Task 1 Step 1). If it 500s, log the response body and assert on the actual validation status allauth returns.

- [ ] **Step 3: Run the full suite**

Run: `pytest -q`
Expected: all tests pass (the prior 20 + this one = 21).

- [ ] **Step 4: Security verification (manual inspection, no code)**

Confirm how the installed allauth verifies a Google **access_token**. Inspect the installed adapter:
`python -c "import allauth, inspect, allauth.socialaccount.providers.google.views as v; print(inspect.getsourcefile(v))"` then read `verify_token` / `complete_login` and `allauth/socialaccount/providers/google/provider.py`.
Record in the PR/notes whether the access_token's audience is validated (e.g. via Google's `tokeninfo` `aud`). If it is NOT, note the mitigation options from the spec (switch that platform to `id_token` + the two deps, or add a `tokeninfo` `aud` check in a custom adapter). Do not silently assume it is safe.

- [ ] **Step 5: Checkpoint** — suite green; security finding recorded. Pause for review.

---

# Phase 2 — Web

### Task 4: Google Identity Services helper

**Files:**
- Create: `frontend/src/googleSignIn.js`

- [ ] **Step 1: Write `frontend/src/googleSignIn.js`**

```javascript
// Loads Google Identity Services and initializes "Sign in with Google", which
// yields a Google id_token (the `credential`). We use renderButton so the flow
// is triggered by Google's own button (more reliable than One Tap prompt()).
const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise = null;

function loadGis() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = GIS_SRC;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
        document.head.appendChild(s);
    });
    return gisPromise;
}

// Loads GIS, initializes with the given credential callback, and returns the
// google.accounts.id API so the caller can renderButton(). `onCredential`
// receives the id_token JWT string.
export async function initGoogleSignIn(onCredential) {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) throw new Error('VITE_GOOGLE_CLIENT_ID is not set');
    await loadGis();
    window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => onCredential(resp.credential),
    });
    return window.google.accounts.id;
}
```

- [ ] **Step 2: Checkpoint** — `cd frontend && npm run lint` clean.

---

### Task 5: `loginWithGoogle` in the web auth store

**Files:**
- Modify: `frontend/src/store/useAuthStore.js`

- [ ] **Step 1: Add the action**

In `frontend/src/store/useAuthStore.js`, add this action immediately after the `login: async (...) => {...},` block:
```javascript
                // ✅ Login with a Google id_token credential (allauth provider/token flow)
                loginWithGoogle: async (credential) => {
                    try {
                        const response = await fetch(`${allAuthEndpoint}/provider/token`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                provider: 'google',
                                process: 'login',
                                token: {
                                    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                                    id_token: credential,
                                },
                            }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                            set({
                                user: data.data?.user || data.user,
                                isAuthenticated: true,
                                sessionToken: data.meta?.session_token,
                            });
                            return {success: true, message: "Login successful!"};
                        }
                        return {success: false, message: data.error || "Google login failed"};
                    } catch (error) {
                        console.error("Google login failed:", error);
                        return {success: false, message: "Server error. Please try again later."};
                    }
                },
```

- [ ] **Step 2: Checkpoint** — `npm run lint` clean.

---

### Task 6: Google button component

**Files:**
- Create: `frontend/Components/GoogleSignInButton.jsx`

- [ ] **Step 1: Write `frontend/Components/GoogleSignInButton.jsx`**

```jsx
import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { initGoogleSignIn } from '../src/googleSignIn';

// Renders Google's official "Sign in with Google" button. On success Google
// calls our callback with a credential (id_token), which we hand to the
// parent's onGoogleLogin (which calls the store + shows the snackbar/closes).
const GoogleSignInButton = ({ onGoogleLogin }) => {
    const containerRef = useRef(null);
    // Keep the latest callback in a ref so the init effect runs only once.
    const cbRef = useRef(onGoogleLogin);
    cbRef.current = onGoogleLogin;

    useEffect(() => {
        let cancelled = false;
        initGoogleSignIn((credential) => cbRef.current(credential))
            .then((idApi) => {
                if (!cancelled && containerRef.current) {
                    idApi.renderButton(containerRef.current, {
                        theme: 'outline',
                        size: 'large',
                        width: 280,
                        text: 'signin_with',
                    });
                }
            })
            .catch((e) => console.error('Google sign-in init error:', e));
        return () => {
            cancelled = true;
        };
    }, []);

    return <div ref={containerRef} style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }} />;
};

GoogleSignInButton.propTypes = {
    onGoogleLogin: PropTypes.func.isRequired,
};

export default GoogleSignInButton;
```

- [ ] **Step 2: Checkpoint** — `npm run lint` clean.

---

### Task 7: Wire the button into AuthForm + App + env

**Files:**
- Modify: `frontend/Components/AuthForm.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Add `VITE_GOOGLE_CLIENT_ID` to `frontend/.env.example`**

Under the "Backend API" section:
```bash
# ── Google SSO (optional) ─────────────────────────────────────────────────────
# Web OAuth client ID from Google Cloud Console (see README "Google Sign-In").
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 2: Render the button in `frontend/Components/AuthForm.jsx`**

Add the import after the existing imports:
```jsx
import GoogleSignInButton from "./GoogleSignInButton.jsx";
```

Change the component signature to accept the new prop:
```jsx
const AuthForm = ({openForgotPassword, onLogin, onSignup, onGoogleLogin}) => {
```

Add the button just before the closing `</Box>` of the form (after the Forgot Password block):
```jsx
            <GoogleSignInButton onGoogleLogin={onGoogleLogin} />
```

Add the prop type (inside `AuthForm.propTypes`):
```jsx
    onGoogleLogin: PropTypes.func.isRequired,
```

- [ ] **Step 3: Add the handler + prop in `frontend/src/App.jsx`**

Add `loginWithGoogle` to the destructured auth store:
```jsx
    const {login, signup, authStage, setAuthStage, loginWithGoogle} = useAuthStore();
```

Add this handler next to `handleLogin`:
```jsx
    const handleGoogleLogin = async (accessToken) => {
        const response = await loginWithGoogle(accessToken);
        if (response.success) {
            showSnackbar(SNACKBAR_MESSAGES.LOGIN_SUCCESS, SNACKBAR_SEVERITIES.SUCCESS);
            setAuthOpen(false);
        } else {
            showSnackbar(
                response.message || SNACKBAR_MESSAGES.LOGIN_FAILURE,
                SNACKBAR_SEVERITIES.ERROR,
            );
        }
    };
```

Pass it to `<AuthForm>` (add the prop to the existing element):
```jsx
                    <AuthForm
                        closeAuth={() => setAuthOpen(false)}
                        openForgotPassword={() => {
                            setAuthOpen(false);
                            setForgotPasswordOpen(true);
                        }}
                        onLogin={handleLogin}
                        onSignup={handleSignup}
                        onGoogleLogin={handleGoogleLogin}
                    />
```

- [ ] **Step 4: Verify**

Run: `cd frontend && npm run lint && npm run build`
Expected: lint clean, build succeeds. (The Google button renders; the live sign-in needs `VITE_GOOGLE_CLIENT_ID` + a real Google account → manual.)

- [ ] **Step 5: Checkpoint** — lint + build green. Pause for review.

---

# Phase 3 — Mobile

### Task 8: Mobile deps + env

**Files:**
- Modify: `mobile/package.json` (via expo install)
- Modify: `mobile/.env.example`

- [ ] **Step 1: Install deps**

Run (from `mobile/`): `npx expo install expo-auth-session expo-crypto`
Expected: both added to `package.json` dependencies.

- [ ] **Step 2: Add env vars to `mobile/.env.example`**

Append:
```bash
# ── Google SSO (optional) ─────────────────────────────────────────────────────
# OAuth client IDs from Google Cloud Console (see README "Google Sign-In").
EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS=
EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID=
```

- [ ] **Step 3: Checkpoint** — `npm run type-check` clean.

---

### Task 9: `loginWithGoogle` in the mobile auth store

**Files:**
- Modify: `mobile/store/useAuthStore.ts`

- [ ] **Step 1: Add the `Platform` import and `loginWithGoogle` to the `AuthState` interface**

In `mobile/store/useAuthStore.ts`, add the import:
```typescript
import { Platform } from 'react-native';
```
and add to the `interface AuthState { ... }`:
```typescript
  loginWithGoogle: (idToken: string) => Promise<AuthResult>;
```

- [ ] **Step 2: Implement it** (add inside the store object, right after `login`)

```typescript
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
```

> **Device-verify:** decode the id_token (jwt.io) and confirm its `aud` matches the client id sent
> here. If expo-auth-session mints the token with `aud` = the **web** client id (it sometimes uses
> the web/server client), send `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB` instead. All three are configured
> in the backend `APPS`, so only the value sent here needs to match the token's `aud`.

- [ ] **Step 3: Checkpoint** — `npm run type-check` clean.

---

### Task 10: Mobile Google button + wire into AuthForm

**Files:**
- Create: `mobile/components/GoogleSignInButton.tsx`
- Modify: `mobile/components/AuthForm.tsx`

- [ ] **Step 1: Write `mobile/components/GoogleSignInButton.tsx`**

```tsx
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
```

- [ ] **Step 2: Render it in `mobile/components/AuthForm.tsx`**

Add the import after the existing imports:
```tsx
import GoogleSignInButton from './GoogleSignInButton';
```

Add the button right after the mode-switch `TouchableOpacity` (just before the closing `</View>` of the form):
```tsx
      <GoogleSignInButton />
```

- [ ] **Step 3: Verify**

Run (from `mobile/`): `npm run type-check && npx jest`
Expected: type-check clean; the existing 8 unit tests still pass.

- [ ] **Step 4: Checkpoint** — type-check + jest green. Pause for review.

---

# Phase 4 — Docs + verification

### Task 11: Google Cloud setup docs + cross-platform verification

**Files:**
- Modify: root `README.md`

- [ ] **Step 1: Add a "Google Sign-In (SSO)" section to root `README.md`**

Insert this section (e.g. after "Configuration"):
```markdown
## Google Sign-In (SSO)

Google login is wired across all three clients via django-allauth's headless token flow; it stays
inert until you provide OAuth client IDs. To enable it:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/select a project and
   configure the **OAuth consent screen** (External; scopes `profile`, `email`; add test users while
   the app is unverified).
2. Create OAuth **client IDs** under *APIs & Services → Credentials*:
   - **Web application** — Authorized JavaScript origins: your web origins (e.g.
     `http://localhost:5173` and your production domain).
   - **iOS** — bundle ID `com.brad.stricherz.WebGISReactNative` (change per fork).
   - **Android** — package name `com.brad.stricherz.WebGISReactNative` + the signing key SHA-1.
3. Set the IDs in each `.env`:
   - `backend/.env`: `GOOGLE_OAUTH_CLIENT_ID_WEB` (+ `GOOGLE_OAUTH_SECRET_WEB`),
     `GOOGLE_OAUTH_CLIENT_ID_IOS`, `GOOGLE_OAUTH_CLIENT_ID_ANDROID`.
   - `frontend/.env`: `VITE_GOOGLE_CLIENT_ID` (the web client ID).
   - `mobile/.env`: `EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB/_IOS/_ANDROID`.

The clients obtain a Google `id_token` and POST it to `/_allauth/app/v1/auth/provider/token`;
allauth verifies the JWT signature and audience, then auto-links to an existing account with the
same verified email. (The allauth Google provider requires `PyJWT` + `cryptography`, which are in
`backend/requirements.txt`.) See `docs/superpowers/specs/2026-06-04-google-sso-design.md` for the
rationale.
```

- [ ] **Step 2: Full automated verification**

```bash
# backend (db up)
cd backend && pytest -q                      # 21 passing
# web
cd ../frontend && npm run lint && npm run build
# mobile
cd ../mobile && npm run type-check && npx jest
```
Expected: all green.

- [ ] **Step 3: Manual verification (user, with real Google credentials)**

After setting the env vars and a Google OAuth client:
- Web: open the sign-in dialog → "Sign in with Google" → consent → returns signed in (snackbar, dialog closes); reload preserves the session.
- Mobile: Account tab → "Sign in with Google" → consent → Account shows signed-in; relaunch preserves the session (SecureStore).
- Same-email link: sign up with email/password, then Google-login with the same Google email → confirm it is the same account (one user).

- [ ] **Step 4: Checkpoint** — automated checks green; manual steps handed to the user.

---

## Self-review (completed by plan author)

**Spec coverage:**
- App token flow + access_token → Tasks 1, 5, 9 (provider/token POST bodies).
- Backend provider config + auto-link + env + no-deps → Tasks 1, 2.
- Backend endpoint test + security verification → Task 3.
- Web GIS access_token + store action + button + wiring → Tasks 4, 5, 6, 7.
- Mobile expo-auth-session + store action + button + deps/env → Tasks 8, 9, 10.
- Google Cloud setup docs + manual verification → Task 11.

**Placeholder scan:** none — every code step has complete content; the security item is an explicit inspection step with the exact command, not a placeholder.

**Type/symbol consistency:** `loginWithGoogle(accessToken)` has the same signature on web and mobile; `requestGoogleAccessToken()`, `GoogleSignInButton`, `onGoogleLogin`, and the env var names (`VITE_GOOGLE_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_ID_WEB/_IOS/_ANDROID`, `EXPO_PUBLIC_GOOGLE_CLIENT_ID_*`) are used consistently across tasks. The provider/token request body (`{provider, process, token:{client_id, access_token}}`) is identical in the backend test, web store, and mobile store.
