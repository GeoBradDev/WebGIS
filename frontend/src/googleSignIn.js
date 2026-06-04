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
