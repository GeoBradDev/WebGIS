import PropTypes from 'prop-types';
import { Box, Typography, Paper, Grid } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PRIMARY_LAYER } from '../src/layers';

// Chart axes and table columns come from the primary layer config (src/layers.js),
// so this dashboard adapts when you point the template at a different dataset.
const Dashboard = ({ data }) => {
    const { categoryField, valueField, valueLabel } = PRIMARY_LAYER.dashboard;
    const columns = PRIMARY_LAYER.columns || [];

    const rows = data.map((row, index) => ({ ...row, id: index }));

    const pieData = data
        .filter((d) => d[valueField])
        .map((item) => ({ name: item[categoryField], value: item[valueField] }));

    const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c', '#8dd1e1'];

    return (
        <Box sx={{ padding: 2, overflow: 'auto', height: '100%' }}>
            <Typography variant="h5" gutterBottom>
                GIS Dashboard
            </Typography>

            <Paper sx={{ height: 400, width: '100%', mb: 4 }}>
                <DataGrid rows={rows} columns={columns} pageSize={10} />
            </Paper>

            <Typography variant="h6" gutterBottom>
                {valueLabel} by {categoryField}
            </Typography>

            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rows}>
                    <XAxis dataKey={categoryField} angle={-45} textAnchor="end" height={80}/>
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey={valueField} fill="#8884d8" />
                </BarChart>
            </ResponsiveContainer>

            <Grid container columns={12} spacing={2} sx={{ mt: 2 }}>
                <Grid gridColumn="span 12" md={6}>
                    <Typography variant="h6">Size Distribution</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100}>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </Grid>

                <Grid gridColumn="span 12">
                    <Typography variant="h6">Top 5 by {valueLabel}</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={[...rows].sort((a, b) => b[valueField] - a[valueField]).slice(0, 5)}>
                            <XAxis dataKey={categoryField} />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey={valueField} fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </Grid>
            </Grid>
        </Box>
    );
};

Dashboard.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Dashboard;
