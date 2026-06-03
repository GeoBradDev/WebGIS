// VerifyEmailPage.jsx
import {useParams, useNavigate} from 'react-router-dom';
import {useEffect, useState} from 'react';
import {Box, Button, CircularProgress, Typography} from '@mui/material';
import {useAuthStore} from '../src/store/useAuthStore.js';

const VerifyEmailPage = () => {
    const {key} = useParams();
    const navigate = useNavigate();
    const verifyEmail = useAuthStore((state) => state.verifyEmail); // Create this function in your auth store
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const verify = async () => {
            try {
                const response = await verifyEmail(key);
                if (response.success) {
                    setSuccess(true);
                    setTimeout(() => {
                        navigate('/');
                    }, 2000);
                } else {
                    setError(response.error || 'Verification failed.');
                }
            } catch {
                setError('Server error during verification.');
            }
            setLoading(false);
        };

        verify();
    }, [key, verifyEmail, navigate]);

    if (loading) {
        return (
            <Box textAlign="center" p={2}>
                <CircularProgress/>
                <Typography>Verifying your email...</Typography>
            </Box>
        );
    }

    if (success) {
        return (
            <Box textAlign="center" p={2}>
                <Typography variant="h6">
                    Your email has been verified! You are now able to Sign in! Redirecting to home...
                </Typography>
            </Box>
        );
    }

    return (
        <Box textAlign="center" p={2}>
            {error ? (
                <>
                    <Typography variant="h6" color="error">
                        {error}
                    </Typography>
                    <Button variant="contained" onClick={() => navigate('/')}>
                        Return Home
                    </Button>
                </>
            ) : (
                <>
                    <Typography variant="h6">Something went wrong.</Typography>
                    <Button variant="contained" onClick={() => navigate('/')}>
                        Go to Home
                    </Button>
                </>
            )}
        </Box>
    );
};

export default VerifyEmailPage;
