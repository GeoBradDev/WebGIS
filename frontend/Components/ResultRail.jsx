import { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import useStore from '../src/store/useStore';
import { PRIMARY_LAYER, featureCenter } from '../src/layers';
import { tokens, mono } from '../src/theme';

// The "Listing" signature: each primary-layer feature as a result card showing a
// big metric, a relative data bar, and a monospace code/coordinate caption.
// Clicking a card flies the map to the feature and highlights it (the store's
// selectedFeatureId is read back by the map's highlight layer).
function ResultRail() {
    const getFilteredPrimaryData = useStore((s) => s.getFilteredPrimaryData);
    const geojsonData = useStore((s) => s.geojsonData);
    const filters = useStore((s) => s.filters);
    const setMapCenter = useStore((s) => s.setMapCenter);
    const selectedFeatureId = useStore((s) => s.selectedFeatureId);
    const setSelectedFeatureId = useStore((s) => s.setSelectedFeatureId);

    const { titleField } = PRIMARY_LAYER.popup || {};
    const { valueField, valueLabel } = PRIMARY_LAYER.dashboard || {};
    const codeRow = (PRIMARY_LAYER.popup?.rows || [])[0];
    const idField = PRIMARY_LAYER.idField;

    // `geojsonData` + `filters` are the values that actually change; the rest are
    // stable (module config / zustand selector) and listed to satisfy the linter.
    const cards = useMemo(() => {
        const fc = getFilteredPrimaryData();
        const features = fc?.features || [];
        const items = features.map((f, i) => {
            const p = f.properties || {};
            const center = featureCenter(f);
            return {
                id: p[idField] ?? f.id ?? i,
                title: p[titleField] ?? p[PRIMARY_LAYER.columns?.[1]?.field] ?? 'Untitled',
                value: Number(p[valueField]),
                code: codeRow ? p[codeRow.field] : null,
                center,
            };
        });
        const max = items.reduce((m, c) => (Number.isFinite(c.value) && c.value > m ? c.value : m), 0);
        items.sort((a, b) => (b.value || 0) - (a.value || 0));
        return { items, max };
    }, [geojsonData, filters]); // eslint-disable-line react-hooks/exhaustive-deps

    const { items, max } = cards;

    const handleSelect = (card) => {
        setSelectedFeatureId(card.id);
        if (card.center) setMapCenter([...card.center]);
    };

    return (
        <Box
            sx={{
                width: 340,
                flexShrink: 0,
                height: '100%',
                bgcolor: 'background.default',
                borderLeft: `1px solid ${tokens.hairline}`,
                display: { xs: 'none', md: 'flex' },
                flexDirection: 'column',
            }}
        >
            <Box sx={{ px: 2.5, pt: 2.25, pb: 1.5, borderBottom: `1px solid ${tokens.hairline}` }}>
                <Typography variant="overline" color="text.secondary">Results</Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
                    <Typography variant="h5" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {items.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {items.length === 1 ? 'place' : 'places'} · by {valueLabel?.toLowerCase()}
                    </Typography>
                </Stack>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5 }}>
                {items.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 4, textAlign: 'center' }}>
                        No places match the current filters. Adjust or reset them in the sidebar.
                    </Typography>
                )}

                <Stack spacing={1.25}>
                    {items.map((card) => {
                        const selected = card.id === selectedFeatureId;
                        const pct = max > 0 && Number.isFinite(card.value) ? Math.max(4, (card.value / max) * 100) : 0;
                        return (
                            <Box
                                key={card.id}
                                onClick={() => handleSelect(card)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(card); } }}
                                sx={{
                                    cursor: 'pointer',
                                    bgcolor: 'background.paper',
                                    borderRadius: 2.5,
                                    p: 1.75,
                                    border: '1px solid',
                                    borderColor: selected ? 'secondary.main' : tokens.hairline,
                                    boxShadow: selected ? `0 0 0 3px ${tokens.coralSoft}` : '0 1px 2px rgba(20,24,38,0.04)',
                                    transition: 'border-color .15s, box-shadow .15s, transform .15s',
                                    '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-1px)' },
                                }}
                            >
                                <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Typography sx={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.25 }}>
                                        {card.title}
                                    </Typography>
                                    {card.code != null && card.code !== '' && (
                                        <Typography sx={{ fontFamily: mono, fontSize: '0.7rem', color: 'text.secondary', flexShrink: 0, mt: '2px' }}>
                                            {card.code}
                                        </Typography>
                                    )}
                                </Stack>

                                <Stack direction="row" spacing={0.75} sx={{ mt: 1, alignItems: 'baseline' }}>
                                    <Typography sx={{ fontFamily: '"Plus Jakarta Sans", sans-serif', fontWeight: 800, fontSize: '1.35rem', fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
                                        {Number.isFinite(card.value) ? card.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">{valueLabel?.toLowerCase()}</Typography>
                                </Stack>

                                {/* Relative data bar — value as a share of the largest result. */}
                                <Box sx={{ mt: 1, height: 5, borderRadius: 999, bgcolor: tokens.surfaceAlt, overflow: 'hidden' }}>
                                    <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 999, bgcolor: 'secondary.main' }} />
                                </Box>

                                {card.center && (
                                    <Stack direction="row" spacing={0.5} sx={{ mt: 1.25, color: 'text.secondary', alignItems: 'center' }}>
                                        <PlaceOutlinedIcon sx={{ fontSize: 13 }} />
                                        <Typography sx={{ fontFamily: mono, fontSize: '0.68rem' }}>
                                            {card.center[0].toFixed(3)}, {card.center[1].toFixed(3)}
                                        </Typography>
                                    </Stack>
                                )}
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        </Box>
    );
}

export default ResultRail;