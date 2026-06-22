// "Listing" design system — a real-estate-forward MUI theme for the WebGIS +
// data dashboard template. Everything visual derives from these tokens, so a
// forker can rebrand the whole app by editing this one file.
//
// Palette is grounded in a confident consumer-property feel: deep indigo chrome,
// a coral accent for actions and live data, green for positive metrics. Type
// pairs Plus Jakarta Sans (display) with Inter (UI) and IBM Plex Mono for codes
// and coordinates (the geospatial voice).
import { createTheme } from '@mui/material/styles';

export const tokens = {
    indigo: '#232347',
    indigoLight: '#363663',
    indigoDark: '#1a1a36',
    coral: '#f0573d',
    coralDark: '#d23f28',
    coralSoft: '#fdeae6',
    green: '#1f9d78',
    amber: '#e0a33e',
    ink: '#1a1a2e',
    slate: '#5b6472',
    canvas: '#f7f8fa',
    surface: '#ffffff',
    surfaceAlt: '#eef0f4',
    hairline: '#e6e8ee',
};

const display = '"Plus Jakarta Sans", "Inter", system-ui, sans-serif';
const body = '"Inter", system-ui, -apple-system, sans-serif';
export const mono = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: tokens.indigo, light: tokens.indigoLight, dark: tokens.indigoDark, contrastText: '#ffffff' },
        secondary: { main: tokens.coral, light: '#ff7a63', dark: tokens.coralDark, contrastText: '#ffffff' },
        success: { main: tokens.green, contrastText: '#ffffff' },
        warning: { main: tokens.amber },
        text: { primary: tokens.ink, secondary: tokens.slate },
        background: { default: tokens.canvas, paper: tokens.surface },
        divider: tokens.hairline,
    },
    shape: { borderRadius: 12 },
    typography: {
        fontFamily: body,
        h1: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.02em' },
        h2: { fontFamily: display, fontWeight: 800, letterSpacing: '-0.02em' },
        h3: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.015em' },
        h4: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.015em' },
        h5: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.01em' },
        h6: { fontFamily: display, fontWeight: 700, letterSpacing: '-0.01em' },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: { fontFamily: body, fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
        // Reusable "eyebrow" label: small, tracked, monospace — used for section
        // headers and stat captions across the app.
        overline: {
            fontFamily: mono,
            fontWeight: 500,
            fontSize: '0.6875rem',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            lineHeight: 1.6,
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: tokens.canvas, WebkitFontSmoothing: 'antialiased' },
                '::-webkit-scrollbar': { width: 10, height: 10 },
                '::-webkit-scrollbar-thumb': { background: '#cfd4de', borderRadius: 8, border: '2px solid transparent', backgroundClip: 'content-box' },
                '::-webkit-scrollbar-thumb:hover': { background: '#b6bccb', backgroundClip: 'content-box' },
                '*:focus-visible': { outline: `2px solid ${tokens.coral}`, outlineOffset: 2 },
            },
        },
        MuiAppBar: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundColor: tokens.indigo, backgroundImage: 'none', borderBottom: `1px solid ${tokens.indigoDark}` },
            },
        },
        MuiPaper: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundImage: 'none' },
                outlined: { borderColor: tokens.hairline },
            },
        },
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { borderRadius: 10, paddingInline: 16 },
                containedSecondary: { '&:hover': { backgroundColor: tokens.coralDark } },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    border: 'none',
                    color: tokens.slate,
                    '&.Mui-selected': { backgroundColor: tokens.surface, color: tokens.ink, boxShadow: '0 1px 3px rgba(20,24,38,0.12)' },
                    '&.Mui-selected:hover': { backgroundColor: tokens.surface },
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: { backgroundColor: tokens.surfaceAlt, borderRadius: 999, padding: 3, gap: 3 },
                grouped: { borderRadius: '999px !important', margin: 0 },
            },
        },
        MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 10 } } },
        MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: tokens.ink, fontSize: '0.75rem' } } },
        MuiDivider: { styleOverrides: { root: { borderColor: tokens.hairline } } },
    },
});

export default theme;