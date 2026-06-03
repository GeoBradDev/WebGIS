import {useState} from "react";
import {useForm} from "react-hook-form";
import {TextField, Button, Box, Typography, CircularProgress} from "@mui/material";
import {useAuthStore} from "../src/store/useAuthStore.js";
import PropTypes from "prop-types";


const AuthForm = ({openForgotPassword, onLogin, onSignup}) => {
    const [isSignup, setIsSignup] = useState(false);
    const {setAuthStage} = useAuthStore();
    const [loading, setLoading] = useState(false);
    const {
        handleSubmit,
        register,
        watch,
        formState: {errors},
    } = useForm();

    const onSubmit = async (data) => {
        setLoading(true);

        if (isSignup) {
            if (!onSignup) {
                console.error("onSignup is not defined in AuthForm");
                setLoading(false);
                return;
            }

            await onSignup({  // ✅ Pass an object, not separate arguments
                email: data.email,
                password: data.password,
                first_name: data.first_name,
                last_name: data.last_name
            });
        } else {
            if (!onLogin) {
                console.error("🚨 onLogin is not defined in AuthForm");
                setLoading(false);
                return;
            }
            await onLogin(data.email, data.password);
        }

        setLoading(false);
    };


    return (
        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{width: 300}}>
            {/* First Name - Only for Registration */}
            {isSignup && (
                <TextField
                    label="First Name"
                    fullWidth
                    margin="normal"
                    {...register("first_name", {required: "First name is required"})}
                    error={!!errors.first_name}
                    helperText={errors.first_name?.message}
                />
            )}

            {/* Last Name - Only for Registration */}
            {isSignup && (
                <TextField
                    label="Last Name"
                    fullWidth
                    margin="normal"
                    {...register("last_name", {required: "Last name is required"})}
                    error={!!errors.last_name}
                    helperText={errors.last_name?.message}
                />
            )}

            <TextField
                label="Email"
                fullWidth
                margin="normal"
                {...register("email", {
                    required: "Email is required",
                    pattern: {value: /^\S+@\S+$/, message: "Invalid email format"}
                })}
                error={!!errors.email}
                helperText={errors.email?.message}
            />

            <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                {...register("password", {
                    required: "Password is required",
                    minLength: {value: 6, message: "Minimum 6 characters"}
                })}
                error={!!errors.password}
                helperText={errors.password?.message}
            />

            {isSignup && (
                <TextField
                    label="Confirm Password"
                    type="password"
                    fullWidth
                    margin="normal"
                    {...register("confirmPassword", {
                        required: "Confirm your password",
                        validate: (value) => value === watch("password") || "Passwords do not match"
                    })}
                    error={!!errors.confirmPassword}
                    helperText={errors.confirmPassword?.message}
                />
            )}

            <Button type="submit" variant="contained" fullWidth sx={{mt: 2}} disabled={loading}>
                {loading ? <CircularProgress size={24}/> : isSignup ? "Signup" : "Login"}
            </Button>

            <Button fullWidth sx={{mt: 1}} onClick={() => {
                if (!isSignup) {
                    setAuthStage("signup");
                } else {
                    setAuthStage("sign in");
                }
                setIsSignup(!isSignup);
            }}
            >
                {isSignup
                    ? "Already have an account? Login"
                    : "Don't have an account? Signup"}
            </Button>

            {/* Forgot Password Link */}
            {!isSignup && (
                <Typography
                    variant="body2"
                    onClick={openForgotPassword}
                    sx={{mt: 1, textDecoration: "underline", cursor: "pointer"}}
                >
                    Forgot Password?
                </Typography>
            )}
        </Box>
    );
};

AuthForm.propTypes = {
    openForgotPassword: PropTypes.func,
    onLogin: PropTypes.func.isRequired,
    onSignup: PropTypes.func.isRequired,
};

export default AuthForm;
