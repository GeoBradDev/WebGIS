import {useState} from 'react';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Stack,
    DialogActions,
    DialogContent,
    Dialog,
    Snackbar,
    Alert,
    ToggleButton,
    ToggleButtonGroup,
    DialogTitle,
} from '@mui/material';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PlaceIcon from '@mui/icons-material/Place';
import Sidebar from '../Components/Sidebar.jsx';
import MapView from '../Components/Mapview.jsx';
import ResultRail from '../Components/ResultRail.jsx';
import AuthForm from "../Components/AuthForm.jsx";
import ForgotPasswordForm from "../Components/ForgotPasswordForm.jsx";
import Dashboard from '../Components/Dashboard.jsx';
import useStore from '../src/store/useStore';
import {useAuthStore} from './store/useAuthStore.js';
import Footer from "../Components/Footer.jsx";
import {SNACKBAR_MESSAGES, SNACKBAR_SEVERITIES} from '../constants/snackbarMessages';
import ReusableModal from "../Components/ReusableModal.jsx";
import TermsModal from "../Components/TermsModal.jsx";
import PrivacyModal from "../Components/PrivacyModal.jsx";

function App() {
    // Map and Dashboard state
    const setMapCenter = useStore((state) => state.setMapCenter);
    const currentView = useStore((state) => state.currentView);
    const toggleView = useStore((state) => state.toggleView);

    // User Auth State
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const logout = useAuthStore((state) => state.logout);
    const {login, signup, authStage, setAuthStage, loginWithGoogle} = useAuthStore();

    // Modals State
    const [aboutOpen, setAboutOpen] = useState(false);
    const [authOpen, setAuthOpen] = useState(false);
    const {snackbar, showSnackbar, hideSnackbar} = useStore();
    const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const [privacyOpen, setPrivacyOpen] = useState(false);

    const geojsonData = useStore((state) => state.geojsonData);

    const handleLogin = async (email, password) => {
        if (!login) {
            console.error("login function is not defined in useAuthStore");
            return;
        }

        const response = await login(email, password); // ✅ Use the full response object

        if (response.success) {
            showSnackbar(SNACKBAR_MESSAGES.LOGIN_SUCCESS, SNACKBAR_SEVERITIES.SUCCESS);
            setAuthOpen(false);
        } else {
            const errorMessage = Array.isArray(response.errors) && response.errors.length > 0
                ? response.errors[0].message
                : `${SNACKBAR_MESSAGES.LOGIN_FAILURE}${response.message ? `: ${response.message}` : ''}`;
            showSnackbar(errorMessage, SNACKBAR_SEVERITIES.ERROR);
        }
    };


    const handleLogout = async () => {

        const response = await logout();

        if (response.success) {
            showSnackbar(SNACKBAR_MESSAGES.LOGOUT_SUCCESS, SNACKBAR_SEVERITIES.INFO);
        } else {
             const errorMessage = Array.isArray(response.errors) && response.errors.length > 0
                ? response.errors[0].message
                : `${SNACKBAR_MESSAGES.LOGOUT_FAILURE}${response.message ? `: ${response.message}` : ''}`;
            showSnackbar(errorMessage, SNACKBAR_SEVERITIES.ERROR);
        }
    };

    const handleGoogleLogin = async (credential) => {
        const response = await loginWithGoogle(credential);
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

    const handleSignup = async (userData) => {
        if (!signup) {
            console.error("signup function is not defined in useAuthStore");
            return;
        }

        const response = await signup(userData);

        if (response.verification_pending) {
            showSnackbar(response.message, SNACKBAR_SEVERITIES.INFO);
            setAuthStage("verify-email");
            setTimeout(() => {
                setAuthOpen(false);
            }, 2000);
        } else if (response.errors && response.errors.length > 0) {
            showSnackbar(`Signup Failed: ${response.errors[0].message}`, SNACKBAR_SEVERITIES.ERROR);
        } else {
            showSnackbar(SNACKBAR_MESSAGES.SIGNUP_FAILURE, SNACKBAR_SEVERITIES.ERROR);
        }
    };
    return (
        <Box sx={{display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden'}}>
            {/* Navbar */}
            <AppBar position="static">
                <Toolbar sx={{gap: 2, minHeight: {xs: 60, sm: 64}}}>
                    {/* Wordmark. "Parcel" is a placeholder brand for forkers to swap. */}
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{flexShrink: 0}}>
                        <Box sx={{
                            width: 34, height: 34, borderRadius: 2,
                            bgcolor: 'secondary.main', display: 'flex',
                            alignItems: 'center', justifyContent: 'center',
                        }}>
                            <PlaceIcon sx={{color: '#fff', fontSize: 20}}/>
                        </Box>
                        <Box sx={{lineHeight: 1}}>
                            <Typography sx={{fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '1.15rem', color: '#fff', letterSpacing: '-0.01em'}}>
                                Parcel
                            </Typography>
                            <Typography variant="overline" sx={{color: 'rgba(255,255,255,0.55)', display: {xs: 'none', sm: 'block'}}}>
                                WebGIS template
                            </Typography>
                        </Box>
                    </Stack>

                    <Box sx={{flexGrow: 1}}/>

                    {/* Segmented Map / Dashboard toggle. */}
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={currentView}
                        onChange={(_, val) => { if (val && val !== currentView) toggleView(); }}
                    >
                        <ToggleButton value="map">
                            <MapOutlinedIcon sx={{fontSize: 18, mr: 0.75}}/> Map
                        </ToggleButton>
                        <ToggleButton value="dashboard">
                            <InsightsOutlinedIcon sx={{fontSize: 18, mr: 0.75}}/> Dashboard
                        </ToggleButton>
                    </ToggleButtonGroup>

                    <Box sx={{flexGrow: 1}}/>

                    <Button color="inherit" onClick={() => setAboutOpen(true)} sx={{color: 'rgba(255,255,255,0.85)', display: {xs: 'none', sm: 'inline-flex'}}}>About</Button>
                    {isAuthenticated ? (
                        <Button variant="outlined" onClick={handleLogout}
                            sx={{color: '#fff', borderColor: 'rgba(255,255,255,0.4)', '&:hover': {borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)'}}}>
                            Sign out
                        </Button>
                    ) : (
                        <Button variant="contained" color="secondary" onClick={() => setAuthOpen(true)}>Sign in</Button>
                    )}
                </Toolbar>
            </AppBar>

            {/* Main Content */}
            <Box sx={{display: 'flex', flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0}}>
                <Sidebar setMapCenter={setMapCenter}/>
                {currentView === 'map' ? (
                    <Box sx={{flex: 1, display: 'flex', minWidth: 0}}>
                        {/* MapView renders its own CollapsibleTable overlay once data loads. */}
                        <MapView/>
                        <ResultRail/>
                    </Box>
                ) : (
                    <Box sx={{flex: 1, overflow: 'auto', minWidth: 0}}>
                        <Dashboard data={geojsonData?.features?.map(f => f.properties) ?? []}/>
                    </Box>
                )}
            </Box>

            {/* About Modal */}
            <ReusableModal
                open={aboutOpen}
                onClose={() => setAboutOpen(false)}
                title="About This Application"
            >
                <Typography>
                    This WebGIS application is designed to provide interactive mapping functionality for users.
                    You can explore geospatial data, interact with map layers, and use the tools provided in the
                    sidebar to customize your experience.
                </Typography>
            </ReusableModal>

            {/* Sign-In Modal */}
            <Dialog open={authOpen} onClose={() => setAuthOpen(false)}>
                <DialogTitle>
                    {authStage === 'signup' ? 'Signup' : 'Sign in'}
                </DialogTitle>
                <DialogContent>
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
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAuthOpen(false)} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Forgot Password Modal */}
            <Dialog open={forgotPasswordOpen} onClose={() => setForgotPasswordOpen(false)}>
                <DialogContent>
                    <ForgotPasswordForm onClose={() => setForgotPasswordOpen(false)}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setForgotPasswordOpen(false)} color="primary">
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for notifications */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={hideSnackbar}
                anchorOrigin={{vertical: 'bottom', horizontal: 'center'}}
                sx={{mb: 4}}
            >
                <Alert onClose={hideSnackbar} severity={snackbar.severity} sx={{width: '100%'}}>
                    {snackbar.message}
                </Alert>

            </Snackbar>
            {/* Footer */}
            <TermsModal open={termsOpen} onClose={() => setTermsOpen(false)}/>
            <PrivacyModal open={privacyOpen} onClose={() => setPrivacyOpen(false)}/>

            <Footer setTermsOpen={setTermsOpen} setPrivacyOpen={setPrivacyOpen}/>
        </Box>
    );
}

export default App;
