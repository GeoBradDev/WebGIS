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
