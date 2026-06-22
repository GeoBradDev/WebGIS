// Design system for the WebGIS + data dashboard template.
//
// Direction: a precise, restrained "scientific instrument" aesthetic for a
// technical audience (researchers, engineers, analysts) — neutral graphite
// chrome, a single measured steel-blue accent, hairline geometry, and a
// technical type system (IBM Plex Sans + IBM Plex Mono). A forker can rebrand
// the whole app by editing the tokens below.
import { createTheme } from '@mui/material/styles';

export const tokens = {
    graphite: '#1c2128',     // chrome / primary
    graphiteLight: '#2d333b',
    graphiteDark: '#14181d',
    accent: '#2c6bb3',       // measured steel blue — actions, active, selection
    accentLight: '#5a90cf',
    accentDark: '#22568f',
    accentSoft: '#e9f0f7',   // selected/hover tint
    green: '#2e8b73',        // positive / secondary data series
    amber: '#d98f2b',        // high-contrast map highlight / annotation
    ink: '#1a1f29',          // primary text
    slate: '#586173',        // secondary text / neutral data series
    canvas: '#f6f7f9',       // app background
    surface: '#ffffff',      // cards / panels
    surfaceAlt: '#eceef1',
    hairline: '#e1e5ea',
};

const sans = '"IBM Plex Sans", system-ui, -apple-system, sans-serif';
export const mono = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", monospace';

const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: tokens.graphite, light: tokens.graphiteLight, dark: tokens.graphiteDark, contrastText: '#ffffff' },
        secondary: { main: tokens.accent, light: tokens.accentLight, dark: tokens.accentDark, contrastText: '#ffffff' },
        success: { main: tokens.green, contrastText: '#ffffff' },
        warning: { main: tokens.amber },
        text: { primary: tokens.ink, secondary: tokens.slate },
        background: { default: tokens.canvas, paper: tokens.surface },
        divider: tokens.hairline,
    },
    shape: { borderRadius: 6 },
    typography: {
        fontFamily: sans,
        h1: { fontFamily: sans, fontWeight: 600, letterSpacing: '-0.015em' },
        h2: { fontFamily: sans, fontWeight: 600, letterSpacing: '-0.015em' },
        h3: { fontFamily: sans, fontWeight: 600, letterSpacing: '-0.01em' },
        h4: { fontFamily: sans, fontWeight: 600, letterSpacing: '-0.01em' },
        h5: { fontFamily: sans, fontWeight: 600, letterSpacing: '-0.005em' },
        h6: { fontFamily: sans, fontWeight: 600 },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: { fontFamily: sans, fontWeight: 600, textTransform: 'none', letterSpacing: 0 },
        // Eyebrow label: small tracked monospace, used for section headers and
        // stat captions — the "instrument readout" voice.
        overline: {
            fontFamily: mono,
            fontWeight: 500,
            fontSize: '0.6875rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            lineHeight: 1.6,
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: { backgroundColor: tokens.canvas, WebkitFontSmoothing: 'antialiased' },
                '::-webkit-scrollbar': { width: 11, height: 11 },
                '::-webkit-scrollbar-thumb': { background: '#c4cad3', borderRadius: 6, border: '3px solid transparent', backgroundClip: 'content-box' },
                '::-webkit-scrollbar-thumb:hover': { background: '#aab2bf', backgroundClip: 'content-box' },
                '*:focus-visible': { outline: `2px solid ${tokens.accent}`, outlineOffset: 1 },
            },
        },
        MuiAppBar: {
            defaultProps: { elevation: 0 },
            styleOverrides: {
                root: { backgroundColor: tokens.graphite, backgroundImage: 'none', borderBottom: `1px solid ${tokens.graphiteDark}` },
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
                root: { borderRadius: 6, paddingInline: 14 },
                containedSecondary: { '&:hover': { backgroundColor: tokens.accentDark } },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    border: 'none',
                    color: tokens.slate,
                    paddingBlock: 5,
                    '&.Mui-selected': { backgroundColor: tokens.surface, color: tokens.ink, boxShadow: '0 1px 2px rgba(20,24,38,0.14)' },
                    '&.Mui-selected:hover': { backgroundColor: tokens.surface },
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: { backgroundColor: tokens.surfaceAlt, borderRadius: 6, padding: 2, gap: 2 },
                grouped: { borderRadius: '4px !important', margin: 0 },
            },
        },
        MuiChip: { styleOverrides: { root: { borderRadius: 4, fontWeight: 500 } } },
        MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 6 } } },
        MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: tokens.ink, fontSize: '0.75rem' } } },
        MuiDivider: { styleOverrides: { root: { borderColor: tokens.hairline } } },
    },
});

export default theme;
