import { useState } from 'react';
import { Typography, TextField, Button, Paper, Box, IconButton, Checkbox, FormControlLabel, Divider, InputAdornment, Select, MenuItem, FormControl, InputLabel, Chip } from '@mui/material';
import { ChevronLeft, ChevronRight, Clear } from '@mui/icons-material';
import PropTypes from 'prop-types';
import useStore from '../src/store/useStore';
import { PRIMARY_LAYER } from '../src/layers';

function Sidebar({ setMapCenter }) {
    const [searchText, setSearchText] = useState('');
    const [isCollapsed, setIsCollapsed] = useState(false); // State to manage collapse
    const setBounds = useStore(state => state.setBounds);
    const layers = useStore(state => state.layers);
    const toggleLayerVisibility = useStore(state => state.toggleLayerVisibility);
    const filters = useStore(state => state.filters);
    const setCategoricalFilter = useStore(state => state.setCategoricalFilter);
    const setRange = useStore(state => state.setRange);
    const resetFilters = useStore(state => state.resetFilters);
    const getUniqueValues = useStore(state => state.getUniqueValues);


    const handleFormSubmit = (event) => {
        event.preventDefault();
    };

    const handleResetFilters = () => {
        resetFilters();
    };

    const handleSearch = async () => {
        if (!searchText.trim()) return;

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                    searchText
                )}`
            );
            const results = await response.json();
            if (results.length > 0) {
                const { lat, lon } = results[0];
                setMapCenter([parseFloat(lat), parseFloat(lon)]);
                const {boundingbox} = results[0]
                const [south, north, west, east] = boundingbox.map(parseFloat)
                setBounds([[south, west], [north, east]])
            } else {
                alert('Location not found.');
            }
        } catch (error) {
            console.error('Error fetching location:', error);
        }
    };

    const handleClearSearch = () => {
        setSearchText('');
    };

    return (
        <Box sx={{ display: 'flex', height: '100%' }}>
            <Paper
                sx={{
                    width: isCollapsed ? '50px' : '300px',
                    transition: 'width 0.3s',
                    padding: isCollapsed ? 1 : 2,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <IconButton
                    onClick={() => setIsCollapsed((prev) => !prev)}
                    sx={{ alignSelf: 'flex-end', marginBottom: 2 }}
                >
                    {isCollapsed ? <ChevronRight /> : <ChevronLeft />}
                </IconButton>

                {!isCollapsed && (
                    <Box sx={{ width: '100%' }}>
                        <Box sx={{ marginTop: 1 }}>
                            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Search</Typography>
                            <Box
                                component="form"
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSearch(); // Trigger the search when the form is submitted
                                }}
                            >
                                <TextField
                                    label="Search"
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    sx={{ marginBottom: 1 }}
                                    slotProps={{
                                        input: {
                                            endAdornment: searchText && (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={handleClearSearch}
                                                        edge="end"
                                                        size="small"
                                                        aria-label="clear search"
                                                    >
                                                        <Clear />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                                <Button
                                    type="submit" // Set the button type to "submit"
                                    variant="contained"
                                    color="secondary"
                                    fullWidth
                                >
                                    Search
                                </Button>
                            </Box>
                        </Box>
                        
                        <Divider sx={{ marginY: 2 }} />
                        
                        {/* Layer Control Section */}
                        <Box sx={{ marginBottom: 2 }}>
                            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', marginBottom: 1.5 }}>Layers</Typography>
                            {Object.values(layers).map((layer) => (
                                <FormControlLabel
                                    key={layer.id}
                                    control={
                                        <Checkbox
                                            checked={layer.visible}
                                            onChange={() => toggleLayerVisibility(layer.id)}
                                            size="small"
                                        />
                                    }
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <span>{layer.name}</span>
                                            {layer.style && (
                                                <Box
                                                    sx={{
                                                        width: 50,
                                                        height: 20,
                                                        backgroundColor: layer.style.fillColor,
                                                        border: `2px solid ${layer.style.lineColor}`,
                                                        borderRadius: 0.5,
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    }
                                    sx={{ 
                                        display: 'flex', 
                                        width: '100%',
                                        marginBottom: 0.5 
                                    }}
                                />
                            ))}
                        </Box>
                        
                        <Divider sx={{ marginY: 2 }} />
                        
                        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>Filter</Typography>
                        <Box
                            component="form"
                            onSubmit={handleFormSubmit}
                            sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                        >
                            {/* Categorical filters, generated from the primary layer config. */}
                            {(PRIMARY_LAYER.categoricalFilters || []).map((f) => (
                                <FormControl key={f.field} fullWidth size="small">
                                    <InputLabel>{f.label}</InputLabel>
                                    <Select
                                        multiple
                                        variant="outlined"
                                        value={filters.categorical[f.field] || []}
                                        onChange={(e) => setCategoricalFilter(f.field, e.target.value)}
                                        renderValue={(selected) => (
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                {selected.map((value) => (
                                                    <Chip key={value} label={value} size="small" />
                                                ))}
                                            </Box>
                                        )}
                                    >
                                        {getUniqueValues(f.field).map((option) => (
                                            <MenuItem key={option} value={option}>
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            ))}

                            {/* Numeric range filter, from the primary layer config. */}
                            {PRIMARY_LAYER.rangeFilter && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <TextField
                                        label={`Min ${PRIMARY_LAYER.rangeFilter.label}`}
                                        variant="outlined"
                                        size="small"
                                        type="number"
                                        value={filters.rangeMin}
                                        onChange={(e) => setRange('rangeMin', e.target.value)}
                                        placeholder="0"
                                        slotProps={{ htmlInput: { step: "0.01" } }}
                                    />
                                    <TextField
                                        label={`Max ${PRIMARY_LAYER.rangeFilter.label}`}
                                        variant="outlined"
                                        size="small"
                                        type="number"
                                        value={filters.rangeMax}
                                        onChange={(e) => setRange('rangeMax', e.target.value)}
                                        placeholder="100"
                                        slotProps={{ htmlInput: { step: "0.01" } }}
                                    />
                                </Box>
                            )}

                            <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                                <Button type="submit" variant="contained" color="secondary" fullWidth>
                                    Apply Filters
                                </Button>
                                <Button
                                    type="button"
                                    variant="text"
                                    color="inherit"
                                    onClick={handleResetFilters}
                                    sx={{ color: 'text.secondary' }}
                                >
                                    Reset
                                </Button>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}

Sidebar.propTypes = {
    setMapCenter: PropTypes.func.isRequired,
};

export default Sidebar;
