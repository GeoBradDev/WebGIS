import PropTypes from 'prop-types';
import { Box, Typography, Paper, Stack } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { PRIMARY_LAYER } from '../src/layers';
import { tokens, mono } from '../src/theme';

// Chart axes and table columns come from the primary layer config (src/layers.js),
// so this dashboard adapts when the template is pointed at a different dataset.

const fmt = (n, d = 0) =>
    Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '—';

// Group raw values into equal-width bins for a size histogram. Adapts to any
// dataset's range, so it stays generic when the template is repointed.
function histogram(values, binCount = 6) {
    if (!values.length) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const width = (max - min) / binCount || 1;
    const bins = Array.from({ length: binCount }, (_, i) => ({
        label: `${fmt(min + i * width, max - min < binCount ? 1 : 0)}–${fmt(min + (i + 1) * width, max - min < binCount ? 1 : 0)}`,
        count: 0,
    }));
    for (const v of values) {
        const idx = Math.min(binCount - 1, Math.max(0, Math.floor((v - min) / width)));
        bins[idx].count += 1;
    }
    return bins;
}

function StatTile({ label, value, unit, sub }) {
    return (
        <Paper variant="outlined" sx={{ p: 2.25, flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">{label}</Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, alignItems: 'baseline' }}>
                <Typography sx={{ fontFamily: mono, fontWeight: 500, fontSize: '1.75rem', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                    {value}
                </Typography>
                {unit && <Typography variant="body2" color="text.secondary">{unit}</Typography>}
            </Stack>
            {sub && (
                <Typography noWrap sx={{ mt: 0.75, fontFamily: mono, fontSize: '0.7rem', color: 'text.secondary' }}>
                    {sub}
                </Typography>
            )}
        </Paper>
    );
}
StatTile.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.node.isRequired,
    unit: PropTypes.string,
    sub: PropTypes.string,
};

function ChartCard({ title, hint, height = 300, children }) {
    return (
        <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" sx={{ mb: 2, justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="h6">{title}</Typography>
                {hint && <Typography variant="overline" color="text.secondary">{hint}</Typography>}
            </Stack>
            <ResponsiveContainer width="100%" height={height}>{children}</ResponsiveContainer>
        </Paper>
    );
}
ChartCard.propTypes = {
    title: PropTypes.string.isRequired,
    hint: PropTypes.string,
    height: PropTypes.number,
    children: PropTypes.element.isRequired,
};

const axisProps = { tick: { fontSize: 11, fill: tokens.slate }, stroke: tokens.hairline };
const tooltipStyle = {
    contentStyle: { borderRadius: 10, border: `1px solid ${tokens.hairline}`, fontSize: 12, fontFamily: 'Inter, sans-serif' },
    cursor: { fill: 'rgba(28,33,40,0.05)' },
};

const Dashboard = ({ data }) => {
    const { categoryField, valueField, valueLabel } = PRIMARY_LAYER.dashboard;
    const columns = PRIMARY_LAYER.columns || [];

    const rows = data.map((row, index) => ({ ...row, id: index }));
    const values = data.map((d) => Number(d[valueField])).filter(Number.isFinite);
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : NaN;
    const largest = data
        .filter((d) => Number.isFinite(Number(d[valueField])))
        .sort((a, b) => Number(b[valueField]) - Number(a[valueField]))[0];

    const bins = histogram(values, 6);
    const topData = [...rows]
        .filter((r) => Number.isFinite(Number(r[valueField])))
        .sort((a, b) => Number(b[valueField]) - Number(a[valueField]))
        .slice(0, 8);

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, height: '100%', overflow: 'auto' }}>
            <Typography variant="overline" color="text.secondary">{PRIMARY_LAYER.name}</Typography>
            <Typography variant="h4" sx={{ mb: 0.5 }}>Overview</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Summary of the active layer. Metrics and charts are driven by{' '}
                <Box component="code" sx={{ fontFamily: mono, fontSize: '0.8em', bgcolor: tokens.surfaceAlt, px: 0.75, py: 0.25, borderRadius: 1 }}>src/layers.js</Box>.
            </Typography>

            {/* Metric tiles */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <StatTile label="Places" value={fmt(data.length)} />
                <StatTile label={`Total ${valueLabel}`} value={fmt(total, 1)} />
                <StatTile label={`Avg ${valueLabel}`} value={fmt(avg, 2)} />
                <StatTile
                    label="Largest"
                    value={largest ? fmt(Number(largest[valueField]), 1) : '—'}
                    sub={largest ? String(largest[categoryField]) : undefined}
                />
            </Stack>

            {/* Charts */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 2 }}>
                <ChartCard title={`Top 8 by ${valueLabel}`} hint="ranked">
                    <BarChart data={topData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={tokens.hairline} vertical={false} />
                        <XAxis dataKey={categoryField} angle={-35} textAnchor="end" height={70} interval={0} {...axisProps} />
                        <YAxis {...axisProps} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey={valueField} name={valueLabel} fill={tokens.accent} radius={[2, 2, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ChartCard>

                <ChartCard title="Distribution" hint={`by ${valueLabel?.toLowerCase()}`}>
                    <BarChart data={bins} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={tokens.hairline} vertical={false} />
                        <XAxis dataKey="label" {...axisProps} interval={0} angle={-20} textAnchor="end" height={48} />
                        <YAxis allowDecimals={false} {...axisProps} />
                        <Tooltip {...tooltipStyle} />
                        <Bar dataKey="count" name="places" fill={tokens.slate} radius={[2, 2, 0, 0]} maxBarSize={46} />
                    </BarChart>
                </ChartCard>
            </Box>

            {/* Attribute table */}
            <Paper variant="outlined" sx={{ p: 2.5 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Records</Typography>
                <Box sx={{ height: 440, width: '100%' }}>
                    <DataGrid
                        rows={rows}
                        columns={columns}
                        density="compact"
                        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                        pageSizeOptions={[10, 25, 50]}
                        disableRowSelectionOnClick
                        sx={{
                            border: 'none',
                            '& .MuiDataGrid-columnHeaders': { bgcolor: tokens.canvas },
                            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 700, fontSize: '0.8rem' },
                            '& .MuiDataGrid-cell': { fontVariantNumeric: 'tabular-nums' },
                        }}
                    />
                </Box>
            </Paper>
        </Box>
    );
};

Dashboard.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Dashboard;